"use client";

// Everything a visitor sets lives in their browser (no accounts in v1): area, local teams,
// services, Spanish toggle, theme and the working plan.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Game, League, PlanItem, Priority, Service, ThemeId } from "@/lib/types";
import { guessTimezone, todayKey } from "@/lib/time";
import { isThemeId } from "@/lib/themes";
import { track } from "@vercel/analytics";

export type Area = {
  label: string;
  source: "ip" | "zip";
  zip: string | null;
  confirmed: boolean;
};

export type LocalTeamPref = { id: string; name: string; leagueId: string };

export type Prefs = {
  area: Area | null;
  localTeams: LocalTeamPref[];
  services: string[];
  spanish: boolean;
  theme: ThemeId;
  tz: string;
  plan: PlanItem[];
  shared: { slug: string; signature: string } | null;
};

const DEFAULTS: Prefs = {
  area: null,
  localTeams: [],
  services: [],
  spanish: false,
  theme: "broadcast",
  tz: "America/Los_Angeles",
  plan: [],
  shared: null,
};

const KEY = "gameday:v1";

function load(): Prefs {
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<Prefs>) : {};
    return { ...DEFAULTS, tz: guessTimezone(), ...parsed, theme: isThemeId(parsed.theme) ? parsed.theme : "broadcast" };
  } catch {
    return { ...DEFAULTS, tz: guessTimezone() };
  }
}

function save(p: Prefs) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // private mode or blocked storage: the app still works for this visit
  }
}

export type Meta = { leagues: League[]; services: Service[]; fixtureMode: boolean; demoDay: string | null };

type Ctx = {
  ready: boolean;
  prefs: Prefs;
  meta: Meta | null;
  theme: ThemeId;
  defaultDay: string;
  update: (fn: (p: Prefs) => Prefs) => void;
  setPriority: (g: Pick<Game, "id" | "start" | "leagueId" | "name">, p: Priority | null) => void;
  priorityOf: (id: string) => Priority | null;
  setTheme: (t: ThemeId) => void;
  /** a page (e.g. a shared plan) can show its own theme without changing the visitor's setting */
  overrideTheme: (t: ThemeId | null) => void;
};

const PrefsContext = createContext<Ctx | null>(null);

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [ready, setReady] = useState(false);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [themeOverride, setThemeOverride] = useState<ThemeId | null>(null);

  useEffect(() => {
    setPrefs(load());
    const q = new URLSearchParams(window.location.search).get("theme");
    if (isThemeId(q)) setThemeOverride(q);
    setReady(true);
    fetch("/api/meta")
      .then((r) => (r.ok ? r.json() : null))
      .then((m) => m && setMeta(m))
      .catch(() => {});
  }, []);

  const theme = themeOverride ?? prefs.theme;
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const update = useCallback((fn: (p: Prefs) => Prefs) => {
    setPrefs((prev) => {
      const next = fn(prev);
      save(next);
      return next;
    });
  }, []);

  const setPriority = useCallback(
    (g: Pick<Game, "id" | "start" | "leagueId" | "name">, p: Priority | null) => {
      update((prev) => {
        const rest = prev.plan.filter((i) => i.eventId !== g.id);
        if (p) track("plan_item_added", { priority: p, league: g.leagueId });
        return {
          ...prev,
          plan: p ? [...rest, { eventId: g.id, priority: p, start: g.start, leagueId: g.leagueId, name: g.name }] : rest,
        };
      });
    },
    [update],
  );

  const priorityOf = useCallback((id: string) => prefs.plan.find((i) => i.eventId === id)?.priority ?? null, [prefs.plan]);

  const setTheme = useCallback(
    (t: ThemeId) => {
      setThemeOverride(null);
      update((p) => ({ ...p, theme: t }));
      track("theme_changed", { theme: t });
    },
    [update],
  );

  const defaultDay = meta?.demoDay ?? todayKey(prefs.tz);

  const overrideTheme = useCallback((t: ThemeId | null) => {
    const q = new URLSearchParams(window.location.search).get("theme");
    setThemeOverride(isThemeId(q) ? q : t);
  }, []);

  const value = useMemo<Ctx>(
    () => ({ ready, prefs, meta, theme, defaultDay, update, setPriority, priorityOf, setTheme, overrideTheme }),
    [ready, prefs, meta, theme, defaultDay, update, setPriority, priorityOf, setTheme, overrideTheme],
  );
  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePrefs(): Ctx {
  const c = useContext(PrefsContext);
  if (!c) throw new Error("usePrefs outside PrefsProvider");
  return c;
}

/** Query string for /api/games from the visitor's settings. */
export function gamesQuery(prefs: Prefs, from: Date, to: Date, extra: Record<string, string> = {}): string {
  const q = new URLSearchParams({
    from: from.toISOString(),
    to: to.toISOString(),
    teams: prefs.localTeams.map((t) => t.id).join(","),
    spanish: prefs.spanish ? "1" : "0",
    ...extra,
  });
  return `/api/games?${q.toString()}`;
}
