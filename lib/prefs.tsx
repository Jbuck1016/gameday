"use client";

// Everything a visitor sets lives in their browser: area, local teams, services, Spanish toggle,
// theme and the working plan. Signing in is optional; when signed in, the same settings are saved
// to the account so they follow the visitor between devices (see lib/sync.ts for how they combine).

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { AccountPrefs, Game, League, PlanItem, Priority, Service, ThemeId } from "@/lib/types";
import { guessTimezone, todayKey } from "@/lib/time";
import { isThemeId } from "@/lib/themes";
import { initTracking, track, visitorId } from "@/lib/track";
import { mergeFirstSignIn, prunePlan, samePrefs } from "@/lib/sync";

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
  /** the account this browser has already merged with; after that the account is the source of truth */
  syncedUser: string | null;
};

const DEFAULTS: Prefs = {
  area: null,
  localTeams: [],
  services: [],
  spanish: false,
  theme: "daylight",
  tz: "America/Los_Angeles",
  plan: [],
  shared: null,
  syncedUser: null,
};

const KEY = "gameday:v1";

function load(): Prefs {
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<Prefs>) : {};
    return { ...DEFAULTS, tz: guessTimezone(), ...parsed, theme: isThemeId(parsed.theme) ? parsed.theme : "daylight" };
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

function toAccount(p: Prefs): AccountPrefs {
  return {
    area: p.area,
    localTeams: p.localTeams,
    services: p.services,
    spanish: p.spanish,
    theme: p.theme,
    tz: p.tz,
    plan: prunePlan(p.plan),
  };
}

function fromAccount(p: Prefs, a: AccountPrefs): Prefs {
  return { ...p, ...a, theme: isThemeId(a.theme) ? a.theme : p.theme };
}

export type Meta = { leagues: League[]; services: Service[]; fixtureMode: boolean; demoDay: string | null };
export type Account = { id: string; email: string | null };
export type SyncState = "idle" | "saving" | "saved" | "error";

type Ctx = {
  ready: boolean;
  prefs: Prefs;
  meta: Meta | null;
  theme: ThemeId;
  defaultDay: string;
  /** undefined while checking, null when signed out */
  account: Account | null | undefined;
  sync: SyncState;
  update: (fn: (p: Prefs) => Prefs) => void;
  setPriority: (g: Pick<Game, "id" | "start" | "leagueId" | "name">, p: Priority | null) => void;
  priorityOf: (id: string) => Priority | null;
  setTheme: (t: ThemeId) => void;
  /** a page (e.g. a shared plan) can show its own theme without changing the visitor's setting */
  overrideTheme: (t: ThemeId | null) => void;
  signedOut: () => void;
};

const PrefsContext = createContext<Ctx | null>(null);

async function putAccount(p: Prefs): Promise<boolean> {
  try {
    const res = await fetch("/api/me", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(toAccount(p)),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [ready, setReady] = useState(false);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [themeOverride, setThemeOverride] = useState<ThemeId | null>(null);
  const [account, setAccount] = useState<Account | null | undefined>(undefined);
  const [sync, setSync] = useState<SyncState>("idle");
  const accountRef = useRef<Account | null | undefined>(undefined);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef<Prefs>(DEFAULTS);

  const pushSoon = useCallback((p: Prefs) => {
    latest.current = p;
    if (!accountRef.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSync("saving");
    saveTimer.current = setTimeout(async () => {
      const ok = await putAccount(latest.current);
      setSync(ok ? "saved" : "error");
    }, 800);
  }, []);

  useEffect(() => {
    initTracking();
    const local = load();
    setPrefs(local);
    latest.current = local;
    const q = new URLSearchParams(window.location.search);
    const qt = q.get("theme");
    if (isThemeId(qt)) setThemeOverride(qt);
    setReady(true);
    fetch("/api/meta")
      .then((r) => (r.ok ? r.json() : null))
      .then((m) => m && setMeta(m))
      .catch(() => {});

    // account: merge on this device's first sign-in, otherwise take the account's copy
    fetch("/api/me")
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then(async (j: { user: Account | null; prefs: AccountPrefs | null }) => {
        accountRef.current = j.user;
        setAccount(j.user);
        // anything the visitor changed while this request was in flight is in latest.current
        const base = latest.current;
        if (!j.user) {
          if (base.syncedUser) {
            const next = { ...base, syncedUser: null };
            setPrefs(next);
            save(next);
          }
          return;
        }
        const firstHere = base.syncedUser !== j.user.id;
        let next: Prefs;
        if (!j.prefs) next = { ...base, syncedUser: j.user.id };
        else if (firstHere) next = { ...fromAccount(base, mergeFirstSignIn(toAccount(base), j.prefs)), syncedUser: j.user.id };
        else next = { ...fromAccount(base, j.prefs), syncedUser: j.user.id };
        setPrefs(next);
        save(next);
        latest.current = next;
        if (!j.prefs || !samePrefs(toAccount(next), j.prefs)) {
          setSync("saving");
          setSync((await putAccount(next)) ? "saved" : "error");
        }
        if (firstHere) {
          const v = visitorId();
          if (v) fetch("/api/me/link", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ visitor: v }) }).catch(() => {});
          track("signed_in", { new_account: !j.prefs, plan: next.plan.length });
        }
        if (q.get("signed_in") === "1") {
          q.delete("signed_in");
          const rest = q.toString();
          window.history.replaceState(null, "", window.location.pathname + (rest ? `?${rest}` : ""));
        }
      })
      .catch(() => {
        accountRef.current = null;
        setAccount(null);
      });
  }, []);

  // the card look; the site itself has one look
  const theme = themeOverride ?? prefs.theme;

  const update = useCallback(
    (fn: (p: Prefs) => Prefs) => {
      setPrefs((prev) => {
        const next = fn(prev);
        save(next);
        pushSoon(next);
        return next;
      });
    },
    [pushSoon],
  );

  const setPriority = useCallback(
    (g: Pick<Game, "id" | "start" | "leagueId" | "name">, p: Priority | null) => {
      update((prev) => {
        const rest = prev.plan.filter((i) => i.eventId !== g.id);
        if (p && !prev.plan.some((i) => i.eventId === g.id && i.priority === p)) {
          track("plan_item_added", { priority: p, league: g.leagueId, size: rest.length + 1 });
        }
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

  const signedOut = useCallback(() => {
    accountRef.current = null;
    setAccount(null);
    setSync("idle");
    setPrefs((prev) => {
      const next = { ...prev, syncedUser: null };
      save(next);
      return next;
    });
  }, []);

  const defaultDay = meta?.demoDay ?? todayKey(prefs.tz);

  const overrideTheme = useCallback((t: ThemeId | null) => {
    const q = new URLSearchParams(window.location.search).get("theme");
    setThemeOverride(isThemeId(q) ? q : t);
  }, []);

  const value = useMemo<Ctx>(
    () => ({ ready, prefs, meta, theme, defaultDay, account, sync, update, setPriority, priorityOf, setTheme, overrideTheme, signedOut }),
    [ready, prefs, meta, theme, defaultDay, account, sync, update, setPriority, priorityOf, setTheme, overrideTheme, signedOut],
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
