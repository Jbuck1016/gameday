import "server-only";
import { createEvents, type EventAttributes } from "ics";
import { getSource } from "@/lib/db/source";
import { loadGames } from "@/lib/server/load";
import { bestWatch, matchupLabel } from "@/lib/games";
import type { CalendarFeed, Game } from "@/lib/types";
import { APP_NAME } from "@/lib/config";
import { dateKey } from "@/lib/time";

const DAY = 86_400_000;
/** where-to-watch is looked up this far ahead; later games show "channel not announced yet" */
const OPTIONS_DAYS = 35;
const HORIZON_DAYS = 120;

function utcArray(ms: number): [number, number, number, number, number] {
  const d = new Date(ms);
  return [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes()];
}

/** Every way to watch, as plain lines for a calendar description. */
export function watchLines(g: Game, services: string[]): string[] {
  const lines: string[] = [];
  for (const o of g.outlets) {
    if (o.confidence === "blacked_out") continue;
    const svc = o.services.filter((s) => s.status === "included" || s.status === "direct").map((s) => s.name);
    const tag = o.confidence === "likely" ? " (likely, not announced)" : o.confidence === "regional" ? " (regional)" : "";
    lines.push(`${o.outlet}${tag}${svc.length ? `: ${svc.join(", ")}` : ""}`);
  }
  const best = bestWatch(g, services);
  if (best?.mine && best.service) lines.unshift(`On your services: ${best.outlet} via ${best.service}`);
  return lines;
}

export function feedEvent(g: Game, feed: CalendarFeed, origin: string, tz: string): EventAttributes {
  const start = Date.parse(g.start);
  const best = bestWatch(g, feed.services);
  const where = best ? (best.confidence === "likely" ? `${best.outlet}?` : best.outlet) : null;
  const lines = watchLines(g, feed.services);
  const description = [
    g.leagueName,
    lines.length ? `Where to watch:\n${lines.join("\n")}` : "Channel not announced yet. This calendar updates as listings come out.",
    g.timeValid ? null : "Start time not confirmed yet.",
    "End time is an estimate.",
    `Plan the day: ${origin}/?day=${dateKey(start, tz)}`,
  ]
    .filter(Boolean)
    .join("\n\n");
  return {
    title: `${matchupLabel(g)}${where ? ` · ${where}` : ""}`,
    start: utcArray(start),
    startInputType: "utc",
    startOutputType: "utc",
    end: utcArray(start + g.durationMin * 60_000),
    endInputType: "utc",
    endOutputType: "utc",
    location: where ?? "Channel TBA",
    description,
    uid: `${g.id.replace(/[^a-zA-Z0-9]/g, "-")}@gameday`,
    url: `${origin}/?day=${dateKey(start, tz)}`,
  };
}

export async function feedGames(feed: CalendarFeed, now = Date.now()): Promise<Game[]> {
  const src = await getSource();
  const from = new Date(now - 2 * DAY);
  const mid = new Date(now + OPTIONS_DAYS * DAY);
  const to = new Date(now + HORIZON_DAYS * DAY);
  const events = await src.teamEvents(feed.teamIds, from, to);
  if (!events.length) return [];
  const near = events.filter((e) => Date.parse(e.start_utc) < mid.getTime());
  const far = events.filter((e) => Date.parse(e.start_utc) >= mid.getTime());
  const leagues = Array.from(new Set(events.map((e) => e.league_id)));
  const [a, b] = await Promise.all([
    near.length
      ? loadGames({ from, to: mid, localTeams: feed.localTeamIds, spanish: feed.spanish, leagues, ids: near.map((e) => e.id) })
      : Promise.resolve([]),
    far.length
      ? loadGames({ from: mid, to, localTeams: feed.localTeamIds, spanish: feed.spanish, leagues, ids: far.map((e) => e.id), withOptions: false })
      : Promise.resolve([]),
  ]);
  return [...a, ...b];
}

export function buildFeedIcs(games: Game[], feed: CalendarFeed, origin: string, tz: string): string {
  const calName = `${APP_NAME}${feed.label ? `: ${feed.label}` : ""}`;
  const { error, value } = createEvents(
    games.map((g) => feedEvent(g, feed, origin, tz)),
    { productId: APP_NAME, calName },
  );
  if (error || !value) throw error ?? new Error("ics failed");
  // ask calendar apps to re-check every few hours so new channel listings show up
  return value.replace("X-PUBLISHED-TTL:PT1H\r\n", "X-PUBLISHED-TTL:PT6H\r\nREFRESH-INTERVAL;VALUE=DURATION:PT6H\r\n");
}
