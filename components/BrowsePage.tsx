"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { usePrefs, gamesQuery } from "@/lib/prefs";
import type { Game, Priority } from "@/lib/types";
import { THEMES, SITE_THEME } from "@/lib/themes";
import { addDays, dateKey, dayParts, formatDayLabel, localDayRange, todayKey } from "@/lib/time";
import { isRanked } from "@/lib/games";
import { featuredGames } from "@/lib/featured";
import { setTrackContext, track } from "@/lib/track";
import { DEFAULT_VIEW, isViewId, type ViewId } from "@/lib/views";
import { AreaBanner } from "./AreaSetup";
import { CardView } from "./views/CardView";
import { BoardView } from "./views/BoardView";
import { TimelineView, timelineGames } from "./views/TimelineView";
import { GameSheet } from "./views/GameSheet";

type Filter = "best" | "mine" | "all" | "live";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "best", label: "Best" },
  { id: "mine", label: "My teams" },
  { id: "all", label: "All" },
  { id: "live", label: "Live" },
];

const VIEWS: { id: ViewId; label: string; icon: React.ReactNode }[] = [
  {
    id: "card",
    label: "Card",
    icon: (
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 7l9-4 9 4-9 4z" />
        <path d="M3 12l9 4 9-4M3 17l9 4 9-4" />
      </svg>
    ),
  },
  {
    id: "timeline",
    label: "Timeline",
    icon: (
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
        <path d="M4 6h9M8 12h12M4 18h7" />
      </svg>
    ),
  },
  {
    id: "board",
    label: "Board",
    icon: (
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M3 9h18M3 14h18" />
      </svg>
    ),
  },
];
const VIEW_KEY = "gameday:view";

// the URL wins (a shared link), then the visitor's last choice, then the default
function readView(): ViewId {
  const q = new URLSearchParams(window.location.search).get("view");
  if (isViewId(q)) return q;
  try {
    const v = window.localStorage.getItem(VIEW_KEY);
    if (isViewId(v)) return v;
  } catch {
    // storage blocked
  }
  return DEFAULT_VIEW;
}

/** Placeholder shaped like the view that's loading, so nothing jumps when games arrive. */
function ViewSkeleton({ view }: { view: ViewId }) {
  if (view === "board")
    return (
      <div aria-hidden="true" className="-mx-4 mt-3 h-[520px] bg-[#0b0b0c] px-4 pt-6 sm:mx-0 sm:rounded-2xl">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="mb-6 h-6 w-full rounded bg-[#1b1c1f]" />
        ))}
      </div>
    );
  if (view === "timeline")
    return (
      <div aria-hidden="true" className="mt-3 grid h-[480px] grid-cols-3 gap-1 pl-10">
        <div className="mt-6 h-56 rounded-xl bg-surface2" />
        <div className="mt-20 h-48 rounded-xl bg-surface2" />
        <div className="mt-40 h-60 rounded-xl bg-surface2" />
      </div>
    );
  return (
    <div aria-hidden="true" className="-mx-4 mt-3 space-y-3.5 bg-[#f2ede3] px-4 pt-20 pb-4 sm:mx-0 sm:rounded-2xl">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-36 bg-[#e4ded2]" />
      ))}
    </div>
  );
}

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
  const [view, setView] = useState<ViewId>(DEFAULT_VIEW);
  const [open, setOpen] = useState<Game | null>(null);

  useEffect(() => {
    if (!ready || !meta || day !== null) return;
    const q = new URLSearchParams(window.location.search).get("day");
    setDay(q && /^\d{4}-\d{2}-\d{2}$/.test(q) ? q : defaultDay);
    setFilter(readFilter());
    const v = readView();
    setView(v);
    setTrackContext({ view: v });
    setNow(Date.now());
  }, [ready, meta, day, defaultDay]);

  // keep LIVE, NEXT and the now line current while the page is open
  useEffect(() => {
    if (!now) return;
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, [now === 0]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const pickView = (v: ViewId) => {
    setView(v);
    setTrackContext({ view: v });
    track("view_changed", { to: v });
    try {
      window.localStorage.setItem(VIEW_KEY, v);
    } catch {
      // storage blocked: the URL still carries it
    }
    const q = new URLSearchParams(window.location.search);
    if (v === DEFAULT_VIEW) q.delete("view");
    else q.set("view", v);
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

  // The timeline's capped set is chosen when the list itself changes, not when a pick changes,
  // so unpicking a game never makes it vanish from under the finger. Shown in kickoff order.
  const visibleKey = visible.map((g) => g.id).join(",");
  const timelineIds = useMemo(
    () => new Set(timelineGames(visible, priorityOf).map((g) => g.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visibleKey],
  );
  const timelineList = useMemo(() => visible.filter((g) => timelineIds.has(g.id)).sort((a, b) => Date.parse(a.start) - Date.parse(b.start)), [visible, timelineIds]);

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
  const viewProps = {
    games: visible,
    tz,
    day: day ?? "",
    // demo data is a past weekend: show it as if it hadn't started, rather than all finished
    nowMs: isToday ? now : meta?.fixtureMode ? 0 : now || Date.now(),
    isToday,
    myServices: prefs.services,
    priorityOf,
    onPriority: (g: Game, p: Priority | null) => setPriority(g, p),
    onOpen: (g: Game) => {
      setOpen(g);
      track("game_opened", { league: g.leagueId });
    },
    formatTime: (ms: number) => theme.formatTime(ms, tz),
    listTestId: filter === "best" ? "best-today" : undefined,
  };
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

      <div role="group" aria-label="View" className="mt-3 grid grid-cols-3 gap-1 rounded-xl bg-surface2 p-1 sm:ml-auto sm:max-w-[360px]">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            aria-pressed={view === v.id}
            onClick={() => pickView(v.id)}
            className={`flex h-11 items-center justify-center gap-1.5 rounded-[9px] text-[13px] ${view === v.id ? "bg-surface font-bold text-ink shadow-[0_1px_2px_rgba(17,19,24,0.12)]" : "font-semibold text-muted"}`}
          >
            {v.icon}
            {v.label}
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
      {!error && games === null && <ViewSkeleton view={view} />}
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

      {games !== null && visible.length > 0 && day ? (
        view === "board" ? (
          <BoardView {...viewProps} games={visible} />
        ) : view === "timeline" ? (
          <TimelineView {...viewProps} games={timelineList} allCount={visible.length} onSeeAll={() => pickView("board")} />
        ) : (
          <CardView {...viewProps} games={visible} reasons={filter === "best" ? reasonsById : undefined} />
        )
      ) : null}

      <GameSheet
        game={open}
        time={open ? (open.timeValid ? theme.formatTime(Date.parse(open.start), tz) : "Time TBC") : ""}
        myServices={prefs.services}
        priority={open ? priorityOf(open.id) : null}
        onPriority={(p) => open && setPriority(open, p)}
        onClose={() => setOpen(null)}
      />

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
        <p className="mt-3 text-xs text-muted">Tap the round button once for Want, again for Must. Tap a game for every way to watch it.</p>
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
