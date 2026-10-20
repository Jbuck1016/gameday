// Snapshot of real data (Fri 23 to Sun 25 Oct 2026, all 12 leagues, watch options for an LA
// viewer) so the site runs locally and in tests without database access.
// Limitation: watch options were computed once for LA local teams; other areas get the same options.

import type { DataSource, EventQuery, WatchQuery } from "./source";
import { randomSlug } from "./source";
import type { EventRow, League, LocalTeam, NewPlan, OptionRow, Service, StoredPlan, Team } from "@/lib/types";
import fixture from "@/fixtures/weekend-2026-10-24.json";

type Fixture = {
  range: { from: string; to: string };
  local_team_ids: string[];
  leagues: League[];
  services: Service[];
  locations: { team_id: string; league_id: string; team_name: string; city: string; lat: number; lon: number }[];
  teams: Team[];
  events: EventRow[];
  options: OptionRow[];
};

const F = fixture as unknown as Fixture;

export const FIXTURE_DAY = "2026-10-24";
export const FIXTURE_LA = { lat: 34.0522, lon: -118.2437, label: "Los Angeles, CA" };

function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const h =
    Math.sin(r(bLat - aLat) / 2) ** 2 + Math.cos(r(aLat)) * Math.cos(r(bLat)) * Math.sin(r(bLon - aLon) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

const plans = new Map<string, StoredPlan>();

export class FixtureSource implements DataSource {
  readonly kind = "fixtures" as const;

  async leagues(): Promise<League[]> {
    return F.leagues;
  }
  async services(): Promise<Service[]> {
    return F.services;
  }
  async events(q: EventQuery): Promise<EventRow[]> {
    return F.events.filter((e) => {
      const t = Date.parse(e.start_utc);
      if (t < q.from.getTime() || t >= q.to.getTime()) return false;
      if (q.leagues?.length && !q.leagues.includes(e.league_id)) return false;
      if (q.ids?.length && !q.ids.includes(e.id)) return false;
      return true;
    });
  }
  async teamsByIds(ids: string[]): Promise<Team[]> {
    const s = new Set(ids);
    return F.teams.filter((t) => s.has(t.id));
  }
  async watchOptions(q: WatchQuery): Promise<OptionRow[]> {
    return F.options.filter((o) => {
      const t = Date.parse(o.start_utc);
      if (t < q.from.getTime() || t >= q.to.getTime()) return false;
      if (q.leagues?.length && !q.leagues.includes(o.league_id)) return false;
      if (!q.spanish && o.note === "Spanish-language") return false;
      return true;
    });
  }
  async suggestLocalTeams(lat: number, lon: number): Promise<LocalTeam[]> {
    return F.locations
      .map((l) => ({
        team_id: l.team_id,
        league_id: l.league_id,
        team_name: l.team_name,
        city: l.city,
        distance_km: Math.round(haversineKm(lat, lon, l.lat, l.lon) * 10) / 10,
      }))
      .filter((l) => l.distance_km <= 160)
      .sort((a, b) => a.distance_km - b.distance_km);
  }
  async suggestLocalTeamsForZip(zip: string): Promise<LocalTeam[] | null> {
    if (zip.startsWith("90")) return this.suggestLocalTeams(FIXTURE_LA.lat, FIXTURE_LA.lon);
    if (zip.startsWith("021")) return this.suggestLocalTeams(42.3601, -71.0589);
    return null;
  }
  async saveZip(): Promise<void> {}
  async searchTeams(q: string, limit: number): Promise<Team[]> {
    const s = q.toLowerCase();
    return F.teams
      .filter((t) => t.name.toLowerCase().includes(s) || (t.abbreviation ?? "").toLowerCase() === s)
      .sort((a, b) => a.name.length - b.name.length)
      .slice(0, limit);
  }
  async teamEvents(teamIds: string[], from: Date, to: Date): Promise<EventRow[]> {
    const s = new Set(teamIds);
    return F.events.filter((e) => {
      const t = Date.parse(e.start_utc);
      return t >= from.getTime() && t < to.getTime() && ((e.home_team_id && s.has(e.home_team_id)) || (e.away_team_id && s.has(e.away_team_id)));
    });
  }
  async createPlan(p: NewPlan): Promise<{ slug: string }> {
    const slug = randomSlug();
    plans.set(slug, {
      id: slug,
      slug,
      title: p.title,
      dateFrom: p.dateFrom,
      dateTo: p.dateTo,
      timezone: p.timezone,
      theme: p.theme,
      areaLabel: p.areaLabel,
      localTeamIds: p.localTeamIds,
      services: p.services,
      spanish: p.spanish,
      items: p.items,
      createdAt: new Date().toISOString(),
    });
    return { slug };
  }
  async getPlan(slug: string): Promise<StoredPlan | null> {
    if (slug === "demo") return demoPlan();
    return plans.get(slug) ?? null;
  }
  async countRecentPlans(): Promise<number> {
    return 0;
  }
}

/** A realistic Saturday built from the snapshot: Arsenal, a big college game, LA hockey, and two extras. */
export function demoPlan(): StoredPlan {
  const sat = F.events.filter((e) => e.start_utc >= "2026-10-24T07:00" && e.start_utc < "2026-10-25T07:00");
  const pick = (re: RegExp, league?: string) => sat.find((e) => re.test(e.name) && (!league || e.league_id === league));
  const chosen: { e: EventRow | undefined; p: "must" | "want" }[] = [
    { e: pick(/Arsenal/, "eng.1"), p: "must" },
    { e: pick(/Real Madrid|Barcelona/, "esp.1") ?? pick(/Dortmund/, "ger.1"), p: "want" },
    { e: pick(/Alabama|Texas|Michigan/, "college-football"), p: "must" },
    { e: pick(/Kings|Ducks/, "nhl"), p: "want" },
    { e: pick(/Lakers|Clippers/, "nba") ?? pick(/LAFC|Galaxy/, "usa.1"), p: "must" },
  ];
  return {
    id: "demo",
    slug: "demo",
    title: "My Saturday",
    dateFrom: FIXTURE_DAY,
    dateTo: FIXTURE_DAY,
    timezone: "America/Los_Angeles",
    theme: "broadcast",
    areaLabel: FIXTURE_LA.label,
    localTeamIds: F.local_team_ids,
    services: ["youtube_tv", "peacock", "espn_plus"],
    spanish: false,
    items: chosen.filter((c) => c.e).map((c) => ({ eventId: c.e!.id, priority: c.p })),
    createdAt: "2026-10-20T00:00:00Z",
  };
}
