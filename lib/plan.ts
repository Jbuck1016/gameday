// One computed view of a plan day, shared by the plan screen, the shared page and the PNG card.

import type { Game, Priority } from "@/lib/types";
import { bestWatch, watchableServices, type BestWatch } from "@/lib/games";
import { gameWindow } from "@/lib/schedule/duration";
import { overlaps, peakScreens, type Segment } from "@/lib/schedule/overlap";
import { servicesNeeded, type CoverResult } from "@/lib/schedule/services";
import { multiviewWindows, type MvWindow } from "@/lib/schedule/multiview";
import { dateKey, minutesIntoDay } from "@/lib/time";

export type DayGame = {
  game: Game;
  priority: Priority;
  start: number;
  end: number;
  runningLong: boolean;
  best: BestWatch | null;
  services: string[];
};

export type DayModel = {
  dayKey: string;
  tz: string;
  games: DayGame[];
  /** timeline extent in minutes after local midnight */
  windowStart: number;
  windowEnd: number;
  overlaps: Segment[];
  peak: number;
  cover: CoverResult;
  multiview: MvWindow[];
};

export function buildDayModel(
  games: Game[],
  priorities: Map<string, Priority>,
  dayKey: string,
  tz: string,
  myServices: string[],
  live: Map<string, string> = new Map(),
  nowMs = Date.now(),
): DayModel {
  const dayGames: DayGame[] = games
    .filter((g) => priorities.has(g.id) && dateKey(Date.parse(g.start), tz) === dayKey)
    .map((g) => {
      const w = gameWindow(g.start, g.durationMin, live.get(g.id) ?? g.status, nowMs);
      return {
        game: g,
        priority: priorities.get(g.id)!,
        start: w.start,
        end: w.end,
        runningLong: w.runningLong,
        best: bestWatch(g, myServices),
        services: watchableServices(g),
      };
    })
    .sort((a, b) => a.start - b.start || a.game.name.localeCompare(b.game.name));

  const startMins = dayGames.map((d) => minutesIntoDay(d.start, dayKey, tz));
  const endMins = dayGames.map((d) => minutesIntoDay(d.end, dayKey, tz));
  const windowStart = Math.max(0, Math.min(7 * 60, ...startMins.map((m) => Math.floor(m / 60) * 60)));
  const windowEnd = Math.min(27 * 60, Math.max(23 * 60, ...endMins.map((m) => Math.ceil(m / 60) * 60)));

  const intervals = dayGames.map((d) => ({ id: d.game.id, start: d.start, end: d.end }));
  return {
    dayKey,
    tz,
    games: dayGames,
    windowStart,
    windowEnd,
    overlaps: overlaps(intervals),
    peak: peakScreens(intervals),
    cover: servicesNeeded(
      dayGames.map((d) => ({ id: d.game.id, priority: d.priority, services: d.services })),
      myServices,
    ),
    multiview: multiviewWindows(
      dayGames.map((d) => ({ id: d.game.id, start: d.start, end: d.end, priority: d.priority, services: d.services })),
      myServices,
    ),
  };
}

/** Distinct local days that have plan games, in order. */
export function planDays(starts: string[], tz: string): string[] {
  return Array.from(new Set(starts.map((s) => dateKey(Date.parse(s), tz)))).sort();
}

export function timelineLabel(g: Game): string {
  if (g.sport === "soccer") return g.home?.short ?? g.name;
  if (g.home && g.away) return `${g.away.abbr}@${g.home.abbr}`;
  return g.leagueShort;
}

/** Card-friendly "where": likely channels are listed together and marked; long local names are shortened. */
export function cardWhere(d: DayGame): { where: string; via: string | null } {
  const best = d.best;
  if (!best) return { where: "Channel TBA", via: null };
  if (best.confidence === "likely") {
    const outs = Array.from(new Set(d.game.outlets.filter((o) => o.basis === "likely").map((o) => o.outlet.replace(" Network", ""))));
    return { where: outs.slice(0, 3).join(" / "), via: "Likely · not announced" };
  }
  const where = best.outlet.split(";")[0].trim();
  const via = best.service && best.service !== best.outlet ? best.service : null;
  return { where, via: best.confidence === "regional" ? `${via ?? ""}${via ? " · " : ""}regional` : via };
}

