// Turn database rows into Game objects, and pick "the best way for you to watch".

import type {
  Confidence,
  EventRow,
  Game,
  League,
  OptionRow,
  OptionStatus,
  OutletOption,
  Team,
  TeamLite,
} from "@/lib/types";
import { contrastRatio, normalizeHex } from "@/lib/contrast";

const CONF_ORDER: Record<Confidence, number> = { confirmed: 0, regional: 1, likely: 2, blacked_out: 3 };
const STATUS_ORDER: Record<OptionStatus, number> = { included: 0, direct: 1, addon: 2, unverified: 3, not_available: 4 };
const BASIS_ORDER: Record<string, number> = { local_team: 0, national: 1, out_of_market: 2, likely: 3 };

function teamLite(t: Team | undefined): TeamLite | null {
  if (!t) return null;
  return {
    id: t.id,
    name: t.name,
    short: t.short_name ?? t.name,
    abbr: t.abbreviation ?? (t.short_name ?? t.name).slice(0, 3).toUpperCase(),
    color: t.color,
    altColor: t.alt_color,
    logo: t.logo_url,
  };
}

export function groupOptions(rows: OptionRow[]): OutletOption[] {
  const byOutlet = new Map<string, OutletOption>();
  for (const r of rows) {
    const key = `${r.basis}|${r.outlet}`;
    let o = byOutlet.get(key);
    if (!o) {
      o = { outlet: r.outlet, basis: r.basis, confidence: r.confidence, note: r.note, services: [] };
      byOutlet.set(key, o);
    }
    if (CONF_ORDER[r.confidence] < CONF_ORDER[o.confidence]) o.confidence = r.confidence;
    if (!o.note && r.note) o.note = r.note;
    if (r.service_id && r.service && !o.services.some((s) => s.id === r.service_id)) {
      o.services.push({ id: r.service_id, name: r.service, status: (r.status ?? "unverified") as OptionStatus, addonName: r.addon_name });
    }
  }
  const out = Array.from(byOutlet.values());
  for (const o of out) o.services.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.name.localeCompare(b.name));
  out.sort(
    (a, b) =>
      CONF_ORDER[a.confidence] - CONF_ORDER[b.confidence] ||
      (BASIS_ORDER[a.basis] ?? 9) - (BASIS_ORDER[b.basis] ?? 9) ||
      a.outlet.localeCompare(b.outlet),
  );
  return out;
}

export function buildGames(events: EventRow[], teams: Team[], leagues: League[], options: OptionRow[]): Game[] {
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const leagueById = new Map(leagues.map((l) => [l.id, l]));
  const optsByEvent = new Map<string, OptionRow[]>();
  for (const o of options) {
    const list = optsByEvent.get(o.event_id) ?? [];
    list.push(o);
    optsByEvent.set(o.event_id, list);
  }
  return events
    .map((e) => {
      const lg = leagueById.get(e.league_id);
      const rows = optsByEvent.get(e.id) ?? [];
      return {
        id: e.id,
        leagueId: e.league_id,
        leagueShort: lg?.short_name ?? e.league_id,
        leagueName: lg?.name ?? e.league_id,
        sport: lg?.sport ?? "",
        start: new Date(e.start_utc).toISOString(),
        timeValid: e.time_valid,
        status: e.status_state,
        name: e.name,
        home: teamLite(e.home_team_id ? teamById.get(e.home_team_id) : undefined),
        away: teamLite(e.away_team_id ? teamById.get(e.away_team_id) : undefined),
        homeRank: e.home_rank,
        awayRank: e.away_rank,
        venue: e.venue,
        neutral: / VS /i.test(e.short_name ?? ""),
        involvesLocal: rows.some((r) => r.involves_local_team),
        durationMin: lg?.default_duration_min ?? 120,
        outlets: groupOptions(rows),
      } satisfies Game;
    })
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start) || a.name.localeCompare(b.name));
}

export type BestWatch = {
  outlet: string;
  service: string | null;
  serviceId: string | null;
  mine: boolean;
  confidence: Confidence;
  extra: number;
};

const WATCHABLE = new Set<OptionStatus>(["included", "direct"]);

/** The single most useful line to show on a game row. */
export function bestWatch(game: Game, myServices: string[]): BestWatch | null {
  const mine = new Set(myServices);
  type Cand = { o: OutletOption; s: Game["outlets"][number]["services"][number] | null; score: number };
  const cands: Cand[] = [];
  for (const o of game.outlets) {
    if (o.confidence === "blacked_out") continue;
    const ss = o.services.filter((s) => WATCHABLE.has(s.status));
    if (!ss.length) {
      cands.push({ o, s: null, score: 100 + CONF_ORDER[o.confidence] * 10 });
      continue;
    }
    for (const s of ss) {
      const score = (mine.has(s.id) ? 0 : 50) + CONF_ORDER[o.confidence] * 10 + STATUS_ORDER[s.status];
      cands.push({ o, s, score });
    }
  }
  if (!cands.length) return null;
  cands.sort((a, b) => a.score - b.score);
  const top = cands[0];
  const servicesForOutlet = top.o.services.filter((s) => WATCHABLE.has(s.status)).length;
  return {
    outlet: top.o.outlet,
    service: top.s?.name ?? null,
    serviceId: top.s?.id ?? null,
    mine: top.s ? mine.has(top.s.id) : false,
    confidence: top.o.confidence,
    extra: Math.max(0, servicesForOutlet - 1),
  };
}

/** Service ids that can actually show this game (for coverage and multiview maths). */
export function watchableServices(game: Game): string[] {
  const out = new Set<string>();
  for (const o of game.outlets) {
    if (o.confidence === "blacked_out") continue;
    for (const s of o.services) if (WATCHABLE.has(s.status)) out.add(s.id);
  }
  return Array.from(out).sort();
}

export function isRanked(g: Game): boolean {
  return g.homeRank != null || g.awayRank != null;
}

export function matchupLabel(g: Game): string {
  if (g.home && g.away) {
    const ar = g.awayRank ? `#${g.awayRank} ` : "";
    const hr = g.homeRank ? `#${g.homeRank} ` : "";
    return g.sport === "soccer" ? `${hr}${g.home.short} v ${ar}${g.away.short}` : `${ar}${g.away.short} at ${hr}${g.home.short}`;
  }
  return g.name;
}

/** The game's colour for bars: the home team's primary or alternate, whichever stands out more on the ground. */
export function teamColor(g: Game, ground: string): string | null {
  const t = g.home ?? g.away;
  if (!t) return null;
  const cands = [t.color, t.altColor].filter((c): c is string => Boolean(c)).map((c) => normalizeHex(c));
  if (!cands.length) return null;
  return cands.sort((a, b) => contrastRatio(b, ground) - contrastRatio(a, ground))[0];
}
