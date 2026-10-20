"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePrefs, gamesQuery } from "@/lib/prefs";
import type { Game } from "@/lib/types";
import { THEMES } from "@/lib/themes";
import { addDays, dateKey, formatDayLabel, localDayRange } from "@/lib/time";
import { isRanked } from "@/lib/games";
import { GameRow } from "./GameRow";
import { AreaBanner } from "./AreaSetup";

type View = "day" | "week";

export function BrowsePage() {
  const { ready, prefs, theme: themeId, defaultDay, setPriority, priorityOf, meta } = usePrefs();
  const theme = THEMES[themeId];
  const [day, setDay] = useState<string | null>(null);
  const [view, setView] = useState<View>("day");
  const [leagues, setLeagues] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [allCbb, setAllCbb] = useState(false);
  const [games, setGames] = useState<Game[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ready && meta && day === null) setDay(defaultDay);
  }, [ready, meta, day, defaultDay]);

  const tz = prefs.tz;
  const teamsKey = prefs.localTeams.map((t) => t.id).join(",");

  useEffect(() => {
    if (!day) return;
    const ctrl = new AbortController();
    const from = localDayRange(day, tz).from;
    const to = localDayRange(addDays(day, view === "week" ? 6 : 0), tz).to;
    setGames(null);
    setError(null);
    fetch(gamesQuery(prefs, from, to, leagues.length ? { leagues: leagues.join(",") } : {}), { signal: ctrl.signal })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "Couldn't load games");
        setGames(j.games as Game[]);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(String(e.message ?? e));
      });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day, view, tz, teamsKey, prefs.spanish, leagues.join(",")]);

  const visible = useMemo(() => {
    if (!games) return [];
    const s = search.trim().toLowerCase();
    return games.filter((g) => {
      if (g.leagueId === "mens-college-basketball" && !allCbb && !isRanked(g) && !g.involvesLocal && !priorityOf(g.id)) return false;
      if (!s) return true;
      return [g.name, g.home?.name, g.away?.name, g.leagueName].some((x) => x?.toLowerCase().includes(s));
    });
  }, [games, search, allCbb, priorityOf]);

  const hiddenCbb = games?.filter((g) => g.leagueId === "mens-college-basketball").length ?? 0;

  const groups = useMemo(() => {
    const out: { key: string; label: string; games: Game[] }[] = [];
    for (const g of visible) {
      const ms = Date.parse(g.start);
      const dk = dateKey(ms, tz);
      const key = view === "week" ? dk : `${dk} ${theme.formatTime(ms, tz)}`;
      const label = view === "week" ? formatDayLabel(dk) : g.timeValid ? theme.formatTime(ms, tz) : "Time TBC";
      const last = out[out.length - 1];
      if (last && last.key === key) last.games.push(g);
      else out.push({ key, label, games: [g] });
    }
    return out;
  }, [visible, tz, view, theme]);

  const toggleLeague = (id: string) => setLeagues((ls) => (ls.includes(id) ? ls.filter((x) => x !== id) : [...ls, id]));

  return (
    <div>
      <AreaBanner />
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label text-sm text-accent">{view === "week" ? "Week of" : "Games on"}</p>
          <h1 className="display text-4xl sm:text-5xl">{day ? formatDayLabel(day) : " "}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn" aria-label="Previous" onClick={() => day && setDay(addDays(day, view === "week" ? -7 : -1))}>
            ←
          </button>
          <label className="sr-only" htmlFor="day-input">
            Date
          </label>
          <input
            id="day-input"
            type="date"
            className="input w-auto"
            value={day ?? ""}
            onChange={(e) => e.target.value && setDay(e.target.value)}
          />
          <button type="button" className="btn" aria-label="Next" onClick={() => day && setDay(addDays(day, view === "week" ? 7 : 1))}>
            →
          </button>
          <div className="flex" role="group" aria-label="View">
            <button type="button" className="btn" aria-pressed={view === "day"} onClick={() => setView("day")}>
              Day
            </button>
            <button type="button" className="btn" aria-pressed={view === "week"} onClick={() => setView("week")}>
              Week
            </button>
          </div>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5" role="group" aria-label="Leagues">
        {(meta?.leagues ?? []).map((l) => (
          <button
            key={l.id}
            type="button"
            className="btn min-h-9 px-2.5 text-xs"
            aria-pressed={leagues.includes(l.id)}
            onClick={() => toggleLeague(l.id)}
            title={l.name}
          >
            {l.short_name}
          </button>
        ))}
        {leagues.length > 0 && (
          <button type="button" className="link px-2 text-xs" onClick={() => setLeagues([])}>
            All leagues
          </button>
        )}
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-3">
        <label className="sr-only" htmlFor="search">
          Search teams
        </label>
        <input
          id="search"
          className="input max-w-sm"
          placeholder="Search a team or league"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {hiddenCbb > 0 && (
          <label className="flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" checked={allCbb} onChange={(e) => setAllCbb(e.target.checked)} />
            All college basketball ({hiddenCbb})
          </label>
        )}
      </div>

      {error && <p className="panel p-4 text-sm">{error}</p>}
      {!error && games === null && <p className="py-10 text-center text-muted">Loading games…</p>}
      {games !== null && visible.length === 0 && (
        <p className="py-10 text-center text-muted">No games match. Try another day or clear the filters.</p>
      )}

      <div className={`${view === "week" ? "space-y-6" : ""} pb-24`}>
        {groups.map((grp) => (
          <section key={grp.key} aria-label={grp.label}>
            {view === "week" && (
              <h2 className="label sticky top-0 z-10 border-b border-line bg-ground py-2 text-sm text-muted">{grp.label}</h2>
            )}
            <ul>
              {grp.games.map((g) => (
                <GameRow
                  key={g.id}
                  game={g}
                  theme={theme}
                  tz={tz}
                  myServices={prefs.services}
                  priority={priorityOf(g.id)}
                  onPriority={(p) => setPriority(g, p)}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>

      {ready && prefs.plan.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
            <span className="label text-sm">
              {prefs.plan.filter((i) => i.priority === "must").length} must · {prefs.plan.filter((i) => i.priority === "want").length} want
            </span>
            <Link href="/plan" className="btn btn-primary no-underline">
              View plan
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
