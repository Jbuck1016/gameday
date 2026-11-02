// The automated X posts: which slot a run is for, how a game reads in the copy, and the copy itself.
// Pure functions, shared by the draft API route and its tests.

import type { Game } from "@/lib/types";

export const POST_TZ = "America/New_York";
export const MAX_GAMES = 4;
export const MIN_GAMES = 3;
const MAX_CHARS = 280;

export type SlotKind = "weekday" | "morning" | "afternoon";
export type Slot = { day: string; kind: SlotKind; fromHour: number; toHour: number; weekday: string };

function etParts(now: Date): { day: string; hour: number; weekday: string } {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: POST_TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "numeric", hourCycle: "h23", weekday: "long" })
      .formatToParts(now)
      .map((x) => [x.type, x.value]),
  );
  return { day: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) % 24, weekday: p.weekday };
}

/**
 * The slot a run at `now` posts for. Weekdays get one post covering noon to midnight ET.
 * Weekends get a morning post (7am to 2pm ET) when run before 10am, and an afternoon post (2pm to midnight) after.
 */
export function slotFor(now: Date): Slot {
  const { day, hour, weekday } = etParts(now);
  const weekend = weekday === "Saturday" || weekday === "Sunday";
  if (!weekend) return { day, kind: "weekday", fromHour: 12, toHour: 24, weekday };
  return hour < 10 ? { day, kind: "morning", fromHour: 7, toHour: 14, weekday } : { day, kind: "afternoon", fromHour: 14, toHour: 24, weekday };
}

export function isSlotKind(x: unknown): x is SlotKind {
  return x === "weekday" || x === "morning" || x === "afternoon";
}

/** The hour (0 to 24) of a game's kickoff on the slot's ET day; 24+ when it falls the next day. */
export function etHourOnDay(ms: number, day: string): number {
  const { day: d, hour } = etParts(new Date(ms));
  const minutes = Number(new Intl.DateTimeFormat("en-US", { timeZone: POST_TZ, minute: "2-digit" }).format(new Date(ms)));
  const h = hour + minutes / 60;
  return d === day ? h : d > day ? 24 + h : -24 + h;
}

export function inSlot(g: Game, slot: Slot): boolean {
  const h = etHourOnDay(Date.parse(g.start), slot.day);
  return h >= slot.fromHour && h < slot.toHour;
}

/** Soccer gets its own post; everything else shares one. */
export function groupOf(g: Game): "soccer" | "other" {
  return g.sport === "soccer" ? "soccer" : "other";
}

const SPORT_WORDS: Record<string, string> = {
  "college-football": "college football",
  nfl: "NFL",
  nba: "NBA",
  nhl: "NHL",
  "mens-college-basketball": "college basketball",
};

/** "soccer", "college football", "NFL"... or "" when the games mix sports. */
export function sportWord(games: Game[]): string {
  if (games.length && games.every((g) => g.sport === "soccer")) return "soccer";
  const leagues = new Set(games.map((g) => g.leagueId));
  return leagues.size === 1 ? (SPORT_WORDS[[...leagues][0]] ?? "") : "";
}

export function postTitle(slot: Slot, games: Game[], splitBySport: boolean): string {
  const part = slot.kind === "morning" ? " morning" : slot.kind === "afternoon" ? " afternoon" : "";
  const sport = splitBySport ? sportWord(games) : "";
  return `${slot.weekday}${part}${sport ? ` ${sport}` : ""} (ET)`;
}

function side(t: Game["home"], rank: number | null): string {
  return `${rank ? `#${rank} ` : ""}${t?.short ?? "TBD"}`;
}

/** "Chelsea v Man Utd", "#22 Arizona at #13 Texas Tech", "#17 Florida vs #3 Georgia" (neutral site). */
export function matchupText(g: Game): string {
  if (g.sport === "soccer") return `${side(g.home, g.homeRank)} v ${side(g.away, g.awayRank)}`;
  return `${side(g.away, g.awayRank)} ${g.neutral ? "vs" : "at"} ${side(g.home, g.homeRank)}`;
}

/** "8:30", "12:00", "1:30": ET clock time without am/pm (a slot never spans the same clock time twice). */
export function clockText(ms: number): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: POST_TZ, hour: "numeric", minute: "2-digit", hour12: true })
    .format(new Date(ms))
    .replace(/\s?[AP]M$/i, "");
}

export function gameLine(g: Game, outlet: string): string {
  return `${clockText(Date.parse(g.start))} ${matchupText(g)} (${outlet})`;
}

/** Title, blank line, one line per game in kickoff order; drops the last games until it fits X's limit. */
export function composePost(title: string, lines: string[]): { text: string; kept: number } {
  let kept = lines.length;
  while (kept > 0) {
    const text = `${title}\n\n${lines.slice(0, kept).join("\n")}`;
    if (text.length <= MAX_CHARS) return { text, kept };
    kept--;
  }
  return { text: title, kept: 0 };
}
