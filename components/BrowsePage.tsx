"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { usePrefs, gamesQuery } from "@/lib/prefs";
import type { Game } from "@/lib/types";
import { THEMES, SITE_THEME } from "@/lib/themes";
import { addDays, dateKey, dayParts, formatDayLabel, localDayRange, todayKey } from "@/lib/time";
import { isRanked } from "@/lib/games";
import { featuredGames } from "@/lib/featured";
import { track } from "@/lib/track";
import { GameRow } from "./GameRow";
import { AreaBanner } from "./AreaSetup";

type Filter = "best" | "mine" | "all" | "live";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "best", label: "Best" },
  { id: "mine", label: "My teams" },
  { id: "all", label: "All" },
  { id: "live", label: "Live" },
];

function readFilter(): Filter {
  const f = new URLSearchParams(window.location.search).get("show");
  return f === "mine" || f === "all" || f === "live" ? f : "best";
}

export function BrowsePage() {
  const router = useRouter();
  const { ready, prefs, defaultDay, setPriority, priorityOf, meta } = usePrefs();
  const theme = THEMES[SITE_THEME];
  const [day, setDay] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("best");
  const [leagues, setLeagues] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [allCbb, setAllCbb] = useState(false);
  const [games, setGames] = useState<Game[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (!ready || !meta || day !== null) return;
    const q = new URLSearchParams(window.location.search).get("day");
    setDay(q && /^\d{4}-\d{2}-\d{2}$/.test(q) ? q : defaultDay);
    setFilter(readFilter());
    setNow(Date.now());
  }, [ready, meta, day, defaultDay]);

  const tz = prefs.tz;
  const teamsKey = prefs.localTeams.map((t) => t.id).join(",");

  useEffect(() => {
    if (!day) return;
    const ctrl = new AbortController();
    const from = localDayRange(day, tz).from;
    const to = localDayRange(day, tz).to;
    setGames(null);
    setError(null);
    fetch(gamesQuery(prefs, from, to), { signal: ctrl.signal })
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
  }, [day, tz, teamsKey, prefs.spanish]);

  // keep the URL shareable: ?day=&show=
  const pickFilter = (f: Filter) => {
    setFilter(f);
    const q = new URLSearchParams(window.location.search);
    if (f === "best") q.delete("show");
    else q.set("show", f);
    window.history.replaceState(null, "", `${window.location.pathname}${q.toString() ? `?${q}` : ""}`);
  };
  const pickDay = (d: string) => {
    setDay(d);
    const q = new URLSearchParams(window.location.search);
    if (d === todayKey(tz) && !meta?.fixtureMode) q.delete("day");
    else q.set("day", d);
    window.history.replaceState(null, "", `${window.location.pathname}${q.toString() ? `?${q}` : ""}`);
  };

  const isToday = !meta?.fixtureMode && day === todayKey(tz);
  const featured = useMemo(() => (games ? featuredGames(games, isToday ? now : 0) : []), [games, isToday, now]);
  const reasonsById = useMemo(() => new Map(featured.map((f) => [f.game.id, f.reasons])), [featured]);

  const visible = useMemo(() => {
    if (!games) return [];
    const s = search.trim().toLowerCase();
    if (filter === "best") return featured.map((f) => f.game);
    return games.filter((g) => {
      if (filter === "mine" && !g.involvesLocal) return false;
      if (filter === "live" && g.status !== "in") return false;
      if (filter === "all") {
        if (leagues.length && !leagues.includes(g.leagueId)) return false;
        if (g.leagueId === "mens-college-basketball" && !allCbb && !isRanked(g) && !g.involvesLocal && !priorityOf(g.id)) return false;
      }
      if (!s) return true;
      return [g.name, g.home?.name, g.away?.name, g.leagueName].some((x) => x?.toLowerCase().includes(s));
    });
  }, [games, search, filter, featured, leagues, allCbb, priorityOf]);

  const hiddenCbb = games?.filter((g) => g.leagueId === "mens-college-basketball").length ?? 0;
  const toggleLeague = (id: string) => setLeagues((ls) => (ls.includes(id) ? ls.filter((x) => x !== id) : [...ls, id]));

  const planAll = () => {
    let added = 0;
    for (const f of featured) {
      if (priorityOf(f.game.id)) continue;
      setPriority(f.game, f.game.involvesLocal ? "must" : "want");
      added++;
    }
    track("featured_planned", { count: featured.length, added, day_offset: isToday ? 0 : 1 });
    router.push(`/plan?day=${day}`);
  };

  const musts = prefs.plan.filter((i) => i.priority === "must").length;
  const parts = day ? dayParts(day) : null;

  return (
    <div className="pb-24">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="display min-w-0 text-3xl">{parts ? (isToday ? "Today" : parts.weekday) : " "}</h1>
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" className="btn h-9 min-h-9 w-9 p-0" aria-label="Previous day" onClick={() => day && pickDay(addDays(day, -1))}>
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 5l-7 7 7 7" /></svg>
          </button>
          <label className="sr-only" htmlFor="day-input">
            Date
          </label>
          <input id="day-input" type="date" className="input h-9 min-h-9 w-auto max-w-36 px-2 text-sm" value={day ?? ""} onChange={(e) => e.target.value && pickDay(e.target.value)} />
          <button type="button" className="btn h-9 min-h-9 w-9 p-0" aria-label="Next day" onClick={() => day && pickDay(addDays(day, 1))}>
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>
      <p className="mt-1 text-sm text-muted">
        {parts ? `${isToday ? formatDayLabel(day!) : parts.date}` : " "}
        {games ? ` · ${games.length} games` : ""}
      </p>
      <div className="mt-2">
        <AreaBanner />
      </div>

      <div className="mt-4 flex gap-1.5 overflow-x-auto" role="tablist" aria-label="Which games">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={filter === f.id}
            className={`btn h-9 min-h-9 shrink-0 px-3.5 text-[13px] ${filter === f.id ? "btn-primary" : ""}`}
            onClick={() => pickFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filter === "all" && (
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Leagues">
            {(meta?.leagues ?? []).map((l) => (
              <button key={l.id} type="button" className="btn min-h-8 px-2.5 text-xs" aria-pressed={leagues.includes(l.id)} onClick={() => toggleLeague(l.id)} title={l.name}>
                {l.short_name}
              </button>
            ))}
            {leagues.length > 0 && (
              <button type="button" className="link px-2 text-xs" onClick={() => setLeagues([])}>
                All leagues
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="sr-only" htmlFor="search">
              Search teams
            </label>
            <input id="search" className="input max-w-sm" placeholder="Search a team or league…" value={search} onChange={(e) => setSearch(e.target.value)} />
            {hiddenCbb > 0 && (
              <label className="flex items-center gap-2 text-sm text-muted">
                <input type="checkbox" checked={allCbb} onChange={(e) => setAllCbb(e.target.checked)} />
                All college basketball ({hiddenCbb})
              </label>
            )}
          </div>
        </div>
      )}

      {error && <p className="panel mt-4 p-4 text-sm">{error}</p>}
      {!error && games === null && (
        <ul className="mt-2" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <li key={i} className="flex items-center gap-3 border-b border-line py-3">
              <span className="h-9 w-12 rounded bg-surface2" />
              <span className="flex flex-1 flex-col gap-2">
                <span className="h-4 w-3/5 rounded bg-surface2" />
                <span className="h-3 w-2/5 rounded bg-surface2" />
              </span>
              <span className="h-11 w-11 rounded-full bg-surface2" />
            </li>
          ))}
        </ul>
      )}
      {games !== null && visible.length === 0 && (
        <p className="py-10 text-center text-sm text-muted">
          {filter === "live"
            ? "Nothing is on right now."
            : filter === "mine"
              ? "None of your teams play on this day."
              : filter === "best" && isToday
                ? "Today's games are done."
                : "No games match. Try another day or clear the filters."}
          {filter === "best" && isToday && day ? (
            <>
              {" "}
              <button type="button" className="link" onClick={() => pickDay(addDays(day, 1))}>
                See tomorrow&apos;s best
              </button>
              {" · "}
            </>
          ) : null}
          {filter !== "all" ? (
            <>
              {" "}
              <button type="button" className="link" onClick={() => pickFilter("all")}>
                See all {games.length}
              </button>
            </>
          ) : null}
        </p>
      )}

      <ul className="row-list mt-1" data-testid={filter === "best" ? "best-today" : undefined}>
        {visible.map((g) => (
          <GameRow
            key={g.id}
            game={g}
            theme={theme}
            tz={tz}
            myServices={prefs.services}
            priority={priorityOf(g.id)}
            onPriority={(p) => setPriority(g, p)}
            reasons={filter === "best" ? reasonsById.get(g.id)?.filter((r) => r !== "Your team" && !/^#\d+ in action$/.test(r)) : undefined}
          />
        ))}
      </ul>

      {filter === "best" && games && featured.length >= 2 && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" className="btn btn-primary" onClick={planAll}>
            Plan these {featured.length}
          </button>
          <span className="text-xs text-muted">
            Your teams go in as Must, the rest as Want. Or{" "}
            <button type="button" className="link" onClick={() => pickFilter("all")}>
              browse all {games.length}
            </button>
            .
          </span>
        </div>
      )}
      {filter === "best" && games && prefs.plan.length === 0 && (
        <p className="mt-3 text-xs text-muted">Tap the circle once for Want, again for Must. Tap a game for every way to watch it.</p>
      )}

      {ready && prefs.plan.length > 0 && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Link
            href={`/plan${day ? `?day=${day}` : ""}`}
            className="pointer-events-auto mx-auto flex max-w-3xl items-center justify-between rounded-full bg-ink px-5 py-3.5 text-sm text-ground no-underline shadow-[0_8px_24px_rgba(17,19,24,0.18)]"
          >
            <span className="font-semibold">
              Your day · {prefs.plan.length} {prefs.plan.length === 1 ? "game" : "games"}
              {musts ? ` · ${musts} must` : ""}
            </span>
            <span className="flex items-center gap-1.5 font-medium text-[#c7cbd3]">
              Plan
              <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 5l7 7-7 7" /></svg>
            </span>
          </Link>
        </div>
      )}
    </div>
  );
}
