"use client";

import { useEffect, useMemo, useState } from "react";
import { usePrefs, type LocalTeamPref } from "@/lib/prefs";
import type { Game } from "@/lib/types";
import { THEMES } from "@/lib/themes";
import { dateKey, formatDayLabel } from "@/lib/time";
import { overlaps } from "@/lib/schedule/overlap";
import { matchupLabel } from "@/lib/games";
import { TeamSearch } from "@/components/TeamSearch";
import { CalendarSubscribe } from "@/components/CalendarSubscribe";
import { track } from "@/lib/track";

export default function TeamsPage() {
  const { prefs, theme: themeId, setPriority, priorityOf } = usePrefs();
  const theme = THEMES[themeId];
  const tz = prefs.tz;
  const [teams, setTeams] = useState<LocalTeamPref[]>([]);
  const [days, setDays] = useState(30);
  const [games, setGames] = useState<Game[] | null>(null);
  const [sameDay, setSameDay] = useState(false);
  const [clashes, setClashes] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!teams.length) {
      setGames(null);
      return;
    }
    const ctrl = new AbortController();
    setGames(null);
    setError(null);
    fetch(`/api/team-games?teams=${encodeURIComponent(teams.map((t) => t.id).join(","))}&days=${days}`, { signal: ctrl.signal })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "Couldn't load");
        setGames(j.games as Game[]);
        track("teams_view_run", { teams: teams.length, days });
      })
      .catch((e) => e.name !== "AbortError" && setError(String(e.message)));
    return () => ctrl.abort();
  }, [teams, days]);

  const byDay = useMemo(() => {
    const ids = new Set(teams.map((t) => t.id));
    const map = new Map<string, Game[]>();
    for (const g of games ?? []) {
      const k = dateKey(Date.parse(g.start), tz);
      map.set(k, [...(map.get(k) ?? []), g]);
    }
    return Array.from(map.entries())
      .map(([k, gs]) => {
        const teamsPlaying = new Set(gs.flatMap((g) => [g.home?.id, g.away?.id]).filter((x): x is string => !!x && ids.has(x)));
        const clash = overlaps(gs.map((g) => ({ id: g.id, start: Date.parse(g.start), end: Date.parse(g.start) + g.durationMin * 60_000 })));
        return { key: k, games: gs, multi: teamsPlaying.size >= 2, clashIds: new Set(clash.flatMap((c) => c.ids)) };
      })
      .filter((d) => (!sameDay || d.multi) && (!clashes || d.clashIds.size > 0))
      .sort((a, b) => a.key.localeCompare(b.key));
  }, [games, teams, tz, sameDay, clashes]);

  return (
    <div className="space-y-8">
      <header>
        <p className="label text-sm text-accent">Teams</p>
        <h1 className="display text-4xl sm:text-5xl">Follow up to six teams</h1>
        <p className="mt-2 text-muted">See every game across leagues, and the days they collide.</p>
      </header>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="space-y-3">
          <TeamSearch
            label="Add a team"
            exclude={teams.map((t) => t.id)}
            onPick={(t) => teams.length < 6 && setTeams((ts) => [...ts, { id: t.id, name: t.name, leagueId: t.league_id }])}
          />
          {teams.length >= 6 && <p className="text-sm text-muted">That&apos;s six: remove one to add another.</p>}
          {teams.length === 0 && prefs.localTeams.length > 0 && (
            <button type="button" className="link text-sm" onClick={() => setTeams(prefs.localTeams.slice(0, 6))}>
              Start with my local teams
            </button>
          )}
          <ul className="flex flex-wrap gap-2">
            {teams.map((t) => (
              <li key={t.id}>
                <button type="button" className="chip min-h-11 px-3" onClick={() => setTeams((ts) => ts.filter((x) => x.id !== t.id))} aria-label={`Remove ${t.name}`}>
                  {t.name} <span aria-hidden>×</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-3">
          <label htmlFor="range" className="label block text-sm text-muted">
            How far ahead
          </label>
          <select id="range" className="input w-auto" value={days} onChange={(e) => setDays(Number(e.target.value))}>
            <option value={30}>Next 30 days</option>
            <option value={90}>Next 3 months</option>
            <option value={180}>Next 6 months</option>
          </select>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" checked={sameDay} onChange={(e) => setSameDay(e.target.checked)} />
            Only days when two or more of these teams play
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" checked={clashes} onChange={(e) => setClashes(e.target.checked)} />
            Only days with a time clash
          </label>
        </div>
      </section>

      <CalendarSubscribe teams={teams} />

      {error && <p className="panel p-4 text-sm">{error}</p>}
      {teams.length > 0 && games === null && !error && <p className="py-6 text-center text-muted">Loading schedules…</p>}
      {games && byDay.length === 0 && <p className="py-6 text-center text-muted">No matching days.</p>}

      <ol className="space-y-4">
        {byDay.map((d) => (
          <li key={d.key} className="border-b border-line pb-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="label text-base">
                {formatDayLabel(d.key)}
                {d.multi && <span className="chip ml-2 text-xs">Multiple teams</span>}
                {d.clashIds.size > 0 && <span className="chip ml-2 text-xs text-accent">Clash</span>}
              </h2>
              <button
                type="button"
                className="btn min-h-9 text-xs"
                onClick={() => d.games.forEach((g) => !priorityOf(g.id) && setPriority(g, "must"))}
              >
                Add day to plan
              </button>
            </div>
            <ul className="mt-2 space-y-1">
              {d.games.map((g) => (
                <li key={g.id} className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="display w-16">{g.timeValid ? theme.formatTime(Date.parse(g.start), tz) : "TBC"}</span>
                  <span className={d.clashIds.has(g.id) ? "text-accent" : ""}>{matchupLabel(g)}</span>
                  <span className="text-xs text-muted">{g.leagueShort}</span>
                  {priorityOf(g.id) && <span className="chip text-xs">In plan</span>}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  );
}
