// Data for the X post graphics (1600x900): a plan day turned into rows, the busiest clash
// window, and the services that cover the day. Shared by every look.

import "server-only";
import type { Game, Priority, StoredPlan } from "@/lib/types";
import { buildDayModel, cardWhere, planDays, type DayModel } from "@/lib/plan";
import { servicesNeeded } from "@/lib/schedule/services";
import { contrastRatio, normalizeHex } from "@/lib/contrast";
import { zonedParts, dayParts } from "@/lib/time";

export const X_W = 1600;
export const X_H = 900;

export type Side = { short: string; abbr: string; rank: number | null; logo: string | null; color: string };
export type XRow = {
  id: string;
  start: number;
  end: number;
  time: string;
  mer: string;
  first: Side;
  second: Side;
  sep: "v" | "at";
  outlet: string;
  likely: boolean;
  priority: Priority;
  league: string;
  clash: boolean;
};
export type XCrunch = { from: number; to: number; fromLabel: string; toLabel: string; rows: XRow[] };
export type XService = { id: string; name: string; games: number; gameIds: string[]; free: boolean };
export type XData = {
  weekday: string;
  date: string;
  dayKey: string;
  tz: string;
  tzLabel: string;
  rows: XRow[];
  windowStart: number;
  windowEnd: number;
  crunch: XCrunch | null;
  /** fewest paid services that cover the day, then free ones only for games no paid service carries */
  services: XService[];
  /** games watchable free (antenna and the like), and the free option that covers most of them */
  free: XService | null;
  host: string;
};

const FREE = new Set(["antenna", "fandango", "youtube_free"]);

export function clock(ms: number, tz: string): { time: string; mer: string } {
  const p = zonedParts(ms, tz);
  const h = p.hour % 12 === 0 ? 12 : p.hour % 12;
  return { time: `${h}:${String(p.minute).padStart(2, "0")}`, mer: p.hour >= 12 ? "PM" : "AM" };
}

/** White or near-black, whichever reads better on `bg`. */
export function inkOn(bg: string): string {
  return contrastRatio("#FFFFFF", bg) >= contrastRatio("#111318", bg) ? "#FFFFFF" : "#111318";
}

function teamHex(c: string | null | undefined, alt: string | null | undefined): string {
  // normalizeHex returns bare hex; CSS needs the #
  const a = c ? `#${normalizeHex(c)}` : null;
  // near-white primaries (white kits) make poor fills; use the alternate when there is one
  if (a && contrastRatio(a, "#FFFFFF") < 1.4 && alt) return `#${normalizeHex(alt)}`;
  return a ?? "#5F6673";
}

// Logos are fetched once per server instance and embedded, so a slow or missing logo
// falls back to the team's abbreviation instead of failing the whole image.
const logoCache = new Map<string, string | null>();

function smallLogoUrl(url: string): string {
  const m = url.match(/^https:\/\/a\.espncdn\.com(\/i\/teamlogos\/.+\.png)$/);
  return m ? `https://a.espncdn.com/combiner/i?img=${m[1]}&h=160&w=160` : url;
}

async function logoData(url: string | null): Promise<string | null> {
  if (!url) return null;
  if (logoCache.has(url)) return logoCache.get(url)!;
  try {
    const r = await fetch(smallLogoUrl(url), { signal: AbortSignal.timeout(2500) });
    if (!r.ok) throw new Error(String(r.status));
    const type = r.headers.get("content-type") ?? "image/png";
    const b64 = Buffer.from(await r.arrayBuffer()).toString("base64");
    const data = `data:${type};base64,${b64}`;
    logoCache.set(url, data);
    return data;
  } catch {
    logoCache.set(url, null);
    return null;
  }
}

async function side(g: Game, home: boolean): Promise<Side> {
  const t = home ? g.home : g.away;
  return {
    short: t?.short ?? (home ? "Home" : "Away"),
    abbr: t?.abbr ?? "",
    rank: home ? g.homeRank : g.awayRank,
    logo: await logoData(t?.logo ?? null),
    color: teamHex(t?.color, t?.altColor),
  };
}

/** Up to `n` rows: every must-watch first, then wants in kickoff order; shown in kickoff order. */
export function pickRows(rows: XRow[], n: number): XRow[] {
  if (rows.length <= n) return rows;
  const musts = rows.filter((r) => r.priority === "must");
  const wants = rows.filter((r) => r.priority !== "must");
  return [...musts, ...wants].slice(0, n).sort((a, b) => a.start - b.start);
}

export async function buildXData(plan: StoredPlan, games: Game[], dayParam: string | null, host: string): Promise<XData> {
  const tz = plan.timezone;
  const days = planDays(
    games.map((g) => g.start),
    tz,
  );
  const dayKey = dayParam && days.includes(dayParam) ? dayParam : (days[0] ?? plan.dateFrom);
  const priorities = new Map(plan.items.map((i) => [i.eventId, i.priority]));
  const model: DayModel = buildDayModel(games, priorities, dayKey, tz, plan.services);
  const clashIds = new Set(model.overlaps.flatMap((o) => o.ids));

  const rows: XRow[] = await Promise.all(
    model.games.map(async (d) => {
      const soccer = d.game.sport === "soccer";
      const [home, away] = await Promise.all([side(d.game, true), side(d.game, false)]);
      const { time, mer } = clock(d.start, tz);
      const { where } = cardWhere(d);
      const likely = d.best?.confidence === "likely";
      return {
        id: d.game.id,
        start: d.start,
        end: d.end,
        time: d.game.timeValid ? time : "TBC",
        mer: d.game.timeValid ? mer : "",
        first: soccer ? home : away,
        second: soccer ? away : home,
        sep: soccer ? "v" : "at",
        // an unannounced channel shows its most likely outlet with a "?"
        outlet: likely ? `${where.split(" / ")[0]}?` : where,
        likely,
        priority: d.priority,
        league: d.game.leagueShort,
        clash: clashIds.has(d.game.id),
      } satisfies XRow;
    }),
  );

  // the busiest overlap: most games at once, earliest first on a tie
  const peak = [...model.overlaps].sort((a, b) => b.ids.length - a.ids.length || a.from - b.from)[0];
  const crunch: XCrunch | null = peak
    ? {
        from: peak.from,
        to: peak.to,
        fromLabel: Object.values(clock(peak.from, tz)).join(" "),
        toLabel: Object.values(clock(peak.to, tz)).join(" "),
        rows: rows.filter((r) => peak.ids.includes(r.id)),
      }
    : null;

  const names = new Map<string, string>();
  for (const d of model.games) for (const o of d.game.outlets) for (const s of o.services) names.set(s.id, s.name);
  const cleanName = (id: string) => (names.get(id) ?? id).replace(" (free)", "");
  // Paid first: the headline is what you'd have to pay for. Free options are added only for
  // games no paid service carries, and reported separately as a bonus.
  const paidGames = model.games.map((d) => ({ id: d.game.id, priority: d.priority, services: d.services.filter((s) => !FREE.has(s)) }));
  const paid = servicesNeeded(paidGames, plan.services).chosen;
  const uncovered = model.games.filter((d) => !d.services.some((s) => paid.includes(s)));
  const extraFree = servicesNeeded(
    uncovered.map((d) => ({ id: d.game.id, priority: d.priority, services: d.services })),
    plan.services,
  ).chosen;
  const services: XService[] = [...paid, ...extraFree].map((id) => {
    const covered = model.games.filter((d) => d.services.includes(id));
    return { id, name: cleanName(id), games: covered.length, gameIds: covered.map((d) => d.game.id), free: FREE.has(id) };
  });
  const freeBest = [...FREE]
    .map((id) => ({ id, ids: model.games.filter((d) => d.services.includes(id)).map((d) => d.game.id) }))
    .sort((a, b) => b.ids.length - a.ids.length)[0];
  const free: XService | null = freeBest?.ids.length
    ? { id: freeBest.id, name: cleanName(freeBest.id), games: freeBest.ids.length, gameIds: freeBest.ids, free: true }
    : null;

  const { weekday, date } = dayParts(dayKey);
  const tzShort = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" })
    .formatToParts(new Date(model.games[0]?.start ?? Date.now()))
    .find((p) => p.type === "timeZoneName")?.value;
  return {
    weekday,
    date,
    dayKey,
    tz,
    // EDT/EST -> ET, PDT -> PT, and so on; anything else as the zone names itself
    tzLabel: tzShort && /^[ECMP][SD]T$/.test(tzShort) ? `${tzShort[0]}T` : (tzShort ?? ""),
    rows,
    windowStart: model.windowStart,
    windowEnd: model.windowEnd,
    crunch,
    services,
    free,
    host,
  };
}
