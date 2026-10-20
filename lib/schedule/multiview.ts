// Multiview planning: find windows where 2 to 4 plan games run at once, say whether one
// service the visitor has covers them all, and suggest games to fill an empty screen.

import type { Priority } from "@/lib/types";
import { overlaps, type Interval } from "./overlap";

export type MvGame = { id: string; start: number; end: number; priority: Priority; services: string[] };

export type Verdict = "single_service" | "split" | "over_four";

export type MvWindow = {
  from: number;
  to: number;
  gameIds: string[];
  verdict: Verdict;
  /** services that carry every game in the window (limited to the visitor's services when they've set any) */
  commonServices: string[];
  /** for over_four: the lowest-priority games to drop to get back to 4 */
  drop: string[];
};

function orderForGrid(games: MvGame[]): MvGame[] {
  return [...games].sort(
    (a, b) => (a.priority === b.priority ? 0 : a.priority === "must" ? -1 : 1) || a.start - b.start || a.id.localeCompare(b.id),
  );
}

export function multiviewWindows(games: MvGame[], myServices: string[]): MvWindow[] {
  const byId = new Map(games.map((g) => [g.id, g]));
  const intervals: Interval[] = games.map((g) => ({ id: g.id, start: g.start, end: g.end }));
  const mine = new Set(myServices);
  return overlaps(intervals).map((seg) => {
    const inWin = orderForGrid(seg.ids.map((id) => byId.get(id)!));
    let common = inWin.reduce<string[] | null>(
      (acc, g) => (acc === null ? [...g.services] : acc.filter((s) => g.services.includes(s))),
      null,
    ) ?? [];
    if (mine.size) common = common.filter((s) => mine.has(s));
    if (inWin.length > 4) {
      // drop wants first, latest-starting first
      const droppable = [...inWin]
        .filter((g) => g.priority === "want")
        .sort((a, b) => b.start - a.start);
      const extra = inWin.length - 4;
      const drop = droppable.slice(0, extra).map((g) => g.id);
      if (drop.length < extra) {
        const musts = [...inWin].filter((g) => g.priority === "must").sort((a, b) => b.start - a.start);
        drop.push(...musts.slice(0, extra - drop.length).map((g) => g.id));
      }
      return { from: seg.from, to: seg.to, gameIds: inWin.map((g) => g.id), verdict: "over_four", commonServices: common, drop };
    }
    return {
      from: seg.from,
      to: seg.to,
      gameIds: inWin.map((g) => g.id),
      verdict: common.length ? "single_service" : "split",
      commonServices: common,
      drop: [],
    };
  });
}

export type FillCandidate = { id: string; start: number; end: number; services: string[] };

/**
 * Up to 3 games outside the plan that cover at least half of the window and are on a
 * service the visitor has. Only offered when the window has free screens.
 */
export function fillSuggestions(win: MvWindow, candidates: FillCandidate[], myServices: string[], limit = 3): string[] {
  const free = 4 - win.gameIds.length;
  if (free <= 0) return [];
  const mine = new Set(myServices);
  const len = win.to - win.from;
  return candidates
    .filter((c) => !win.gameIds.includes(c.id))
    .filter((c) => (mine.size === 0 ? c.services.length > 0 : c.services.some((s) => mine.has(s))))
    .map((c) => ({ c, cover: Math.max(0, Math.min(c.end, win.to) - Math.max(c.start, win.from)) / len }))
    .filter((x) => x.cover >= 0.5)
    .sort((a, b) => b.cover - a.cover || a.c.start - b.c.start)
    .slice(0, Math.min(limit, free))
    .map((x) => x.c.id);
}
