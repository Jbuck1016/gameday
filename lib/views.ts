// Layout and status logic shared by the Today page's three views (Timeline, Board, Card).
// Pure functions, so the views stay thin and this part is unit tested.

import type { Game } from "@/lib/types";
import { gameWindow } from "@/lib/schedule/duration";

export type ViewId = "card" | "timeline" | "board";
export const VIEW_IDS: ViewId[] = ["card", "timeline", "board"];
export const DEFAULT_VIEW: ViewId = "card";

export function isViewId(x: unknown): x is ViewId {
  return typeof x === "string" && (VIEW_IDS as string[]).includes(x);
}

export type Span = { id: string; start: number; end: number };

/** Greedy lanes: each game goes in the first lane that is free when it starts. */
export function assignLanes(spans: Span[]): { lane: Map<string, number>; lanes: number } {
  const ends: number[] = [];
  const lane = new Map<string, number>();
  for (const s of [...spans].sort((a, b) => a.start - b.start || a.end - b.end || a.id.localeCompare(b.id))) {
    let i = ends.findIndex((e) => e <= s.start);
    if (i === -1) {
      i = ends.length;
      ends.push(s.end);
    } else ends[i] = s.end;
    lane.set(s.id, i);
  }
  return { lane, lanes: ends.length };
}

/** Stretches of time with two or more games on at once, and how many. */
export function overlapBands(spans: Span[]): { from: number; to: number; n: number }[] {
  const pts = Array.from(new Set(spans.flatMap((s) => [s.start, s.end]))).sort((a, b) => a - b);
  const out: { from: number; to: number; n: number }[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const n = spans.filter((s) => s.start <= a && s.end >= b).length;
    if (n < 2) continue;
    const last = out[out.length - 1];
    if (last && last.to === a && last.n === n) last.to = b;
    else out.push({ from: a, to: b, n });
  }
  return out;
}

export function spanOf(g: Game, nowMs: number): Span {
  const w = gameWindow(g.start, g.durationMin, g.status, nowMs);
  return { id: g.id, start: w.start, end: w.end };
}

export type BoardStatus = "final" | "live" | "next" | "later";

/**
 * Where each game stands at `nowMs`: finished, on now, the next kickoff (every game at that
 * earliest upcoming time), or later. The feed's status wins over the clock when it has one.
 */
export function boardStatus(games: Game[], nowMs: number): Map<string, BoardStatus> {
  const out = new Map<string, BoardStatus>();
  let next = Infinity;
  for (const g of games) {
    if (!g.timeValid) {
      // no real kickoff time: only the feed's own status says anything
      out.set(g.id, g.status === "post" ? "final" : g.status === "in" ? "live" : "later");
      continue;
    }
    const s = spanOf(g, nowMs);
    if (g.status === "post" || (g.status !== "in" && s.end <= nowMs)) out.set(g.id, "final");
    else if (g.status === "in" || s.start <= nowMs) out.set(g.id, "live");
    else {
      out.set(g.id, "later");
      next = Math.min(next, s.start);
    }
  }
  for (const g of games) if (g.timeValid && out.get(g.id) === "later" && Date.parse(g.start) === next) out.set(g.id, "next");
  return out;
}
