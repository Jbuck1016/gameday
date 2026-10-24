"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import type { Game } from "@/lib/types";
import type { Theme } from "@/lib/themes";
import { featuredGames } from "@/lib/featured";
import { usePrefs } from "@/lib/prefs";
import { track } from "@/lib/track";
import { BestWatchLine, PriorityButtons, TeamMark } from "./GameRow";

/** The day's best games, with one tap to put them all in a plan. */
export function BestToday({ games, day, isToday, theme, tz }: { games: Game[]; day: string; isToday: boolean; theme: Theme; tz: string }) {
  const router = useRouter();
  const { prefs, setPriority, priorityOf } = usePrefs();
  // "now" only matters for today; other days are judged from their start
  const picks = useMemo(() => featuredGames(games, isToday ? Date.now() : 0), [games, isToday]);
  if (picks.length < 2) return null;

  const planAll = () => {
    let added = 0;
    for (const f of picks) {
      if (priorityOf(f.game.id)) continue;
      setPriority(f.game, f.game.involvesLocal ? "must" : "want");
      added++;
    }
    track("featured_planned", { count: picks.length, added, day_offset: isToday ? 0 : 1 });
    router.push(`/plan?day=${day}`);
  };

  return (
    <section aria-labelledby="best-h" className="panel mb-6 p-4" data-testid="best-today">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="best-h" className="label text-sm text-accent">
          {isToday ? "Best today" : "Best on this day"}
        </h2>
        {prefs.plan.length === 0 && (
          <p className="text-xs text-muted">Tap Must or Want on anything you&apos;d watch. Your plan lays out channels, clashes and the services you need.</p>
        )}
      </div>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2">
        {picks.map(({ game: g, reasons }) => {
          const homeFirst = g.sport === "soccer";
          const first = homeFirst ? g.home : g.away;
          const second = homeFirst ? g.away : g.home;
          const fr = homeFirst ? g.homeRank : g.awayRank;
          const sr = homeFirst ? g.awayRank : g.homeRank;
          return (
            <li key={g.id} className="flex flex-col gap-2 border border-line p-3" data-testid="best-game">
              <div className="flex items-center justify-between gap-2">
                <span className="display text-base">
                  {g.timeValid ? theme.formatTime(Date.parse(g.start), tz) : "TBC"}
                  <span className="label ml-2 text-xs text-muted">{g.leagueShort}</span>
                </span>
                <span className="flex flex-wrap justify-end gap-1">
                  {reasons.map((r) => (
                    <span key={r} className="chip text-xs">
                      {r}
                    </span>
                  ))}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold">
                {first && (
                  <span className="flex items-center gap-1.5">
                    <TeamMark logo={first.logo} abbr={first.abbr} />
                    {fr ? <span className="text-muted">#{fr}</span> : null}
                    {first.short}
                  </span>
                )}
                <span className="font-normal text-muted">{homeFirst ? "v" : "at"}</span>
                {second && (
                  <span className="flex items-center gap-1.5">
                    <TeamMark logo={second.logo} abbr={second.abbr} />
                    {sr ? <span className="text-muted">#{sr}</span> : null}
                    {second.short}
                  </span>
                )}
                {!first && !second && <span>{g.name}</span>}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <BestWatchLine game={g} myServices={prefs.services} />
                <PriorityButtons game={g} priority={priorityOf(g.id)} onChange={(p) => setPriority(g, p)} />
              </div>
            </li>
          );
        })}
      </ul>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" className="btn btn-primary" onClick={planAll}>
          Plan these {picks.length}
        </button>
        <span className="text-xs text-muted">Local teams go in as Must, the rest as Want. You can change any of them.</span>
      </div>
    </section>
  );
}
