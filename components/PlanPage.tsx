"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePrefs, gamesQuery, type Prefs } from "@/lib/prefs";
import type { Game, PlanItem, Priority } from "@/lib/types";
import { THEMES, THEME_IDS, SITE_THEME, barStyle } from "@/lib/themes";
import { addDays, dateKey, formatDayLabel, localDayRange, minutesIntoDay } from "@/lib/time";
import { planDays } from "@/lib/plan";
import { PlanView } from "./PlanView";
import { track } from "@/lib/track";

type Size = "portrait" | "story" | "square" | "wide";
type WideLook = "grid" | "departures" | "card";
type WideKind = "slate" | "crunch" | "cover";

// wide (16:9) images for X and group chats: three looks, three things to show
const WIDE_LOOKS: { id: WideLook; label: string }[] = [
  { id: "grid", label: "Timeline" },
  { id: "departures", label: "Departures board" },
  { id: "card", label: "Fight card" },
];
const WIDE_KINDS: { id: WideKind; label: string }[] = [
  { id: "slate", label: "The whole day" },
  { id: "crunch", label: "Busiest clash" },
  { id: "cover", label: "What it takes to watch" },
];

function signature(p: Prefs): string {
  return JSON.stringify({
    items: [...p.plan].map((i) => [i.eventId, i.priority]).sort(),
    t: p.theme,
    l: p.localTeams.map((t) => t.id).sort(),
    s: [...p.services].sort(),
    sp: p.spanish,
    a: p.area?.label ?? null,
    tz: p.tz,
  });
}

function WeekView({ items, tz, startDay, onPick, leagueMinutes }: { items: PlanItem[]; tz: string; startDay: string; onPick: (d: string) => void; leagueMinutes: Map<string, number> }) {
  const theme = THEMES[SITE_THEME];
  const days = Array.from({ length: 7 }, (_, i) => addDays(startDay, i));
  return (
    <ul className="space-y-2" aria-label="Week view">
      {days.map((d) => {
        const its = items.filter((i) => dateKey(Date.parse(i.start), tz) === d).sort((a, b) => a.start.localeCompare(b.start));
        return (
          <li key={d}>
            <button type="button" className="flex w-full items-center gap-3 text-left" onClick={() => onPick(d)} disabled={!its.length}>
              <span className="label w-24 shrink-0 text-sm">{formatDayLabel(d, "short")}</span>
              <span className="relative h-6 flex-1 bg-surface2">
                {its.map((i) => {
                  const s = minutesIntoDay(Date.parse(i.start), d, tz);
                  const len = leagueMinutes.get(i.leagueId) ?? 120;
                  const bs = barStyle(theme, i.priority, null);
                  return (
                    <span
                      key={i.eventId}
                      className="absolute top-1 h-4"
                      style={{ left: `${(s / 1440) * 100}%`, width: `${(len / 1440) * 100}%`, background: bs.background, border: bs.border, backgroundImage: bs.backgroundImage, boxSizing: "border-box" }}
                      title={i.name}
                    />
                  );
                })}
              </span>
              <span className="w-16 shrink-0 text-right text-xs text-muted">{its.length ? `${its.length} game${its.length > 1 ? "s" : ""}` : "—"}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function PlanPage() {
  const { ready, prefs, update, setPriority, theme: themeId, setTheme, defaultDay, meta, account } = usePrefs();
  const tz = prefs.tz;
  const [shareOpen, setShareOpen] = useState(false);
  const days = useMemo(() => planDays(prefs.plan.map((i) => i.start), tz), [prefs.plan, tz]);
  const [day, setDay] = useState<string | null>(null);
  const [tab, setTab] = useState<"day" | "week">("day");
  const [games, setGames] = useState<Game[] | null>(null);
  const [live, setLive] = useState<Map<string, string>>(new Map());
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [size, setSize] = useState<Size>("portrait");
  const [wideLook, setWideLook] = useState<WideLook>("grid");
  const [wideKind, setWideKind] = useState<WideKind>("slate");

  useEffect(() => {
    if (!ready || !days.length) return;
    if (!day || !days.includes(day)) {
      const q = new URLSearchParams(window.location.search).get("day");
      setDay(q && days.includes(q) ? q : (days.find((d) => d >= defaultDay) ?? days[0]));
    }
  }, [ready, days, day, defaultDay]);

  useEffect(() => {
    if (ready) track("plan_viewed", { games: prefs.plan.length, days: days.length });
    // once per visit to the page
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const teamsKey = prefs.localTeams.map((t) => t.id).join(",");
  useEffect(() => {
    if (!day) return;
    const ctrl = new AbortController();
    const r = localDayRange(day, tz);
    setGames(null);
    fetch(gamesQuery(prefs, r.from, r.to), { signal: ctrl.signal })
      .then((res) => res.json())
      .then((j) => setGames((j.games as Game[]) ?? []))
      .catch((e) => e.name !== "AbortError" && setGames([]));
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day, tz, teamsKey, prefs.spanish]);

  const priorities = useMemo(() => new Map<string, Priority>(prefs.plan.map((i) => [i.eventId, i.priority])), [prefs.plan]);

  // live status: poll only while a plan game is on or about to start
  useEffect(() => {
    if (!games) return;
    const now = Date.now();
    const watch = games.filter((g) => priorities.has(g.id)).filter((g) => {
      const s = Date.parse(g.start);
      return s - now < 30 * 60_000 && now - s < (g.durationMin + 90) * 60_000;
    });
    if (!watch.length) return;
    const ids = watch.map((g) => g.id).join(",");
    const poll = () =>
      fetch(`/api/live?ids=${encodeURIComponent(ids)}`)
        .then((r) => r.json())
        .then((j) => setLive(new Map((j.live as { id: string; state: string }[]).map((l) => [l.id, l.state]))))
        .catch(() => {});
    poll();
    const t = setInterval(poll, 60_000);
    return () => clearInterval(t);
  }, [games, priorities]);

  const serviceNames = useMemo(() => new Map((meta?.services ?? []).map((s) => [s.id, s.name])), [meta]);
  const leagueMinutes = useMemo(() => new Map((meta?.leagues ?? []).map((l) => [l.id, l.default_duration_min])), [meta]);

  const ensureShared = useCallback(async (): Promise<string> => {
    const sig = signature(prefs);
    if (prefs.shared?.signature === sig) return prefs.shared.slug;
    const keys = planDays(prefs.plan.map((i) => i.start), tz);
    const res = await fetch("/api/plans", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: null,
        dateFrom: keys[0],
        dateTo: keys[keys.length - 1],
        timezone: tz,
        theme: prefs.theme,
        areaLabel: prefs.area?.label ?? null,
        localTeamIds: prefs.localTeams.map((t) => t.id),
        services: prefs.services,
        spanish: prefs.spanish,
        items: prefs.plan.map((i) => ({ eventId: i.eventId, priority: i.priority })),
      }),
    });
    const j = await res.json();
    if (!res.ok) throw new Error(j.error ?? "Couldn't save the plan");
    update((p) => ({ ...p, shared: { slug: j.slug, signature: sig } }));
    return j.slug as string;
  }, [prefs, tz, update]);

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label);
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const exportImage = () =>
    run("export", async () => {
      const slug = await ensureShared();
      const wide = size === "wide";
      const url = wide
        ? `/api/og/x?plan=${slug}&look=${wideLook}&kind=${wideKind}&day=${day}`
        : `/api/card?plan=${slug}&theme=${themeId}&size=${size}&day=${day}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Couldn't render the image. Try again in a moment.");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = wide ? `gameday-${day}-${wideKind}-${wideLook}.png` : `gameday-${day}-${themeId}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
      track("card_exported", wide ? { look: wideLook, kind: wideKind, size } : { theme: themeId, size });
      setMsg("Image saved.");
    });

  const copyLink = () =>
    run("link", async () => {
      const slug = await ensureShared();
      const link = `${window.location.origin}/p/${slug}`;
      try {
        await navigator.clipboard.writeText(link);
        setMsg(`Link copied: ${link}`);
      } catch {
        setMsg(`Share this link: ${link}`);
      }
      track("share_link_copied");
    });

  const calendar = () =>
    run("ics", async () => {
      const slug = await ensureShared();
      track("ics_downloaded");
      window.location.href = `/api/ics?plan=${slug}`;
    });

  if (!ready) return <p className="py-10 text-center text-muted">Loading…</p>;
  if (!prefs.plan.length) {
    return (
      <div className="panel p-8 text-center">
        <h1 className="display text-2xl">Nothing planned yet</h1>
        <p className="mt-2 text-sm text-muted">Tap the circle on any game to add it, or start from today&apos;s best and take out what you don&apos;t want.</p>
        <Link href="/" className="btn btn-primary mt-6 no-underline">
          See today&apos;s best
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1" role="group" aria-label="Plan view">
          <button type="button" className="btn h-9 min-h-9 px-3.5 text-[13px]" aria-pressed={tab === "day"} onClick={() => setTab("day")}>
            Day
          </button>
          <button type="button" className="btn h-9 min-h-9 px-3.5 text-[13px]" aria-pressed={tab === "week"} onClick={() => setTab("week")}>
            Week
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="link text-sm"
            onClick={() => {
              if (window.confirm("Clear every game from your plan?")) update((p) => ({ ...p, plan: [], shared: null }));
            }}
          >
            Clear
          </button>
          <button type="button" className="btn btn-primary h-10 min-h-10" aria-expanded={shareOpen} aria-controls="share-panel" onClick={() => setShareOpen((o) => !o)}>
            Share
          </button>
        </div>
      </div>

      {tab === "week" && day && (
        <WeekView
          items={prefs.plan}
          tz={tz}
          startDay={day}
          leagueMinutes={leagueMinutes}
          onPick={(d) => {
            setDay(d);
            setTab("day");
          }}
        />
      )}

      {tab === "day" && day && games === null && <p className="py-10 text-center text-muted">Loading your day…</p>}
      {tab === "day" && day && games !== null && (
        <PlanView
          games={games}
          priorities={priorities}
          day={day}
          days={days}
          onDay={setDay}
          tz={tz}
          themeId={SITE_THEME}
          myServices={prefs.services}
          areaLabel={prefs.area?.label ?? null}
          live={live}
          serviceNames={serviceNames}
          onPriority={(g, p) => setPriority(g, p)}
        />
      )}

      {shareOpen && (
      <section id="share-panel" aria-labelledby="share-h" className="panel space-y-4 p-4">
        <h2 id="share-h" className="label text-sm">
          Share this day
        </h2>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {/* each label stays with its menu when the row wraps on a phone */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted" htmlFor="card-size">
              Size
            </label>
            <select id="card-size" className="input w-auto" value={size} onChange={(e) => setSize(e.target.value as Size)}>
              <option value="portrait">Post (4:5)</option>
              <option value="wide">Wide (16:9), for X</option>
              <option value="story">Story (9:16)</option>
              <option value="square">Square</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted" htmlFor="card-theme">
              Look
            </label>
            {size === "wide" ? (
              <select id="card-theme" className="input w-auto" value={wideLook} onChange={(e) => setWideLook(e.target.value as WideLook)}>
                {WIDE_LOOKS.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </select>
            ) : (
              <select id="card-theme" className="input w-auto" value={themeId} onChange={(e) => setTheme(e.target.value as typeof themeId)}>
                {THEME_IDS.map((t) => (
                  <option key={t} value={t}>
                    {THEMES[t].label}
                  </option>
                ))}
              </select>
            )}
          </div>
          {size === "wide" ? (
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted" htmlFor="card-kind">
                Show
              </label>
              <select id="card-kind" className="input w-auto" value={wideKind} onChange={(e) => setWideKind(e.target.value as WideKind)}>
                {WIDE_KINDS.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-primary" onClick={exportImage} disabled={!!busy}>
            {busy === "export" ? "Rendering…" : "Export image"}
          </button>
          <button type="button" className="btn" onClick={copyLink} disabled={!!busy}>
            {busy === "link" ? "Saving…" : "Copy link"}
          </button>
          <button type="button" className="btn" onClick={calendar} disabled={!!busy}>
            Add to calendar
          </button>
        </div>
        {msg && (
          <p className="text-sm" role="status">
            {msg}
          </p>
        )}
      </section>
      )}

      {account === null && prefs.plan.length >= 2 && (
        <p className="text-sm">
          This plan only lives in this browser.{" "}
          <Link href="/signin?next=/plan" className="link">
            Sign in to keep it on every device
          </Link>
        </p>
      )}

      <p className="text-sm text-muted">
        Want your teams&apos; games in your calendar, with channels filled in as they&apos;re announced?{" "}
        <Link href="/teams" className="link">
          Follow your teams
        </Link>
      </p>
    </div>
  );
}
