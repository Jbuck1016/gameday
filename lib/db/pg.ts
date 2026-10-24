// Postgres access as the gameday_web role through Supabase's transaction pooler.
// The pooler host isn't known in advance (aws-0 or aws-1), so we try both and keep the one that works.

import postgres from "postgres";
import type { DataSource, EventQuery, WatchQuery } from "./source";
import { randomSlug } from "./source";
import type { EventRow, League, LocalTeam, NewPlan, OptionRow, Service, StoredPlan, Team, ThemeId } from "@/lib/types";

const PROJECT_REF = "soknxaqllvdpshezjbnw";
const POOLER_HOSTS = ["aws-0-us-west-2.pooler.supabase.com", "aws-1-us-west-2.pooler.supabase.com"];

type Sql = postgres.Sql<Record<string, never>>;
const g = globalThis as unknown as { __gamedaySql?: Promise<Sql> | null };

function candidateUrls(): string[] {
  if (process.env.GAMEDAY_DATABASE_URL) return [process.env.GAMEDAY_DATABASE_URL];
  const user = process.env.GAMEDAY_DB_USER ?? `gameday_web.${PROJECT_REF}`;
  const pw = process.env.GAMEDAY_DB_PASSWORD ?? "";
  return POOLER_HOSTS.map(
    (h) => `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(pw)}@${h}:6543/postgres`,
  );
}

async function connect(): Promise<Sql> {
  let lastErr: unknown = null;
  for (const url of candidateUrls()) {
    const sql = postgres(url, {
      prepare: false,
      max: 3,
      idle_timeout: 20,
      connect_timeout: 8,
      ssl: "require",
    }) as unknown as Sql;
    try {
      await sql`select 1`;
      return sql;
    } catch (e) {
      lastErr = e;
      await sql.end({ timeout: 1 }).catch(() => {});
    }
  }
  throw lastErr ?? new Error("No database connection could be made");
}

export function getSql(): Promise<Sql> {
  if (!g.__gamedaySql) {
    g.__gamedaySql = connect().catch((e) => {
      g.__gamedaySql = null;
      throw e;
    });
  }
  return g.__gamedaySql;
}

const iso = (v: unknown): string => (v instanceof Date ? v.toISOString() : String(v));
const num = (v: unknown): number => (typeof v === "number" ? v : Number(v));
const dateOnly = (v: unknown): string => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10));

function toEvent(r: Record<string, unknown>): EventRow {
  return {
    id: String(r.id),
    league_id: String(r.league_id),
    start_utc: iso(r.start_utc),
    time_valid: Boolean(r.time_valid),
    status_state: (r.status_state as string) ?? null,
    home_team_id: (r.home_team_id as string) ?? null,
    away_team_id: (r.away_team_id as string) ?? null,
    name: String(r.name),
    short_name: (r.short_name as string) ?? null,
    venue: (r.venue as string) ?? null,
    home_rank: r.home_rank == null ? null : num(r.home_rank),
    away_rank: r.away_rank == null ? null : num(r.away_rank),
  };
}

function toLocal(r: Record<string, unknown>): LocalTeam {
  return {
    team_id: String(r.team_id),
    league_id: String(r.league_id),
    team_name: String(r.team_name),
    city: (r.city as string) ?? null,
    distance_km: num(r.distance_km),
  };
}

const EVENT_COLS = "id, league_id, start_utc, time_valid, status_state, home_team_id, away_team_id, name, short_name, venue, home_rank, away_rank";

export class PgSource implements DataSource {
  readonly kind = "postgres" as const;
  private leagueCache: { at: number; rows: League[] } | null = null;

  async leagues(): Promise<League[]> {
    if (this.leagueCache && Date.now() - this.leagueCache.at < 600_000) return this.leagueCache.rows;
    const sql = await getSql();
    const rows = await sql`select id, sport, name, short_name, default_duration_min from gameday.leagues where active order by id`;
    const out = rows.map((r) => ({
      id: String(r.id),
      sport: String(r.sport),
      name: String(r.name),
      short_name: String(r.short_name),
      default_duration_min: num(r.default_duration_min),
    }));
    if (out.length) this.leagueCache = { at: Date.now(), rows: out };
    return out;
  }

  async services(): Promise<Service[]> {
    const sql = await getSql();
    const rows = await sql`select id, name, kind from gameday.services order by name`;
    return rows.map((r) => ({ id: String(r.id), name: String(r.name), kind: String(r.kind) }));
  }

  async events(q: EventQuery): Promise<EventRow[]> {
    const sql = await getSql();
    const rows = await sql`
      select ${sql.unsafe(EVENT_COLS)} from gameday.events
      where start_utc >= ${q.from} and start_utc < ${q.to}
      ${q.leagues?.length ? sql`and league_id = any(${q.leagues}::text[])` : sql``}
      ${q.ids?.length ? sql`and id = any(${q.ids}::text[])` : sql``}
      order by start_utc, id`;
    return rows.map(toEvent);
  }

  async teamsByIds(ids: string[]): Promise<Team[]> {
    if (!ids.length) return [];
    const sql = await getSql();
    const rows = await sql`
      select id, league_id, name, short_name, abbreviation, color, alt_color, logo_url
      from gameday.teams where id = any(${ids}::text[])`;
    return rows as unknown as Team[];
  }

  async watchOptions(q: WatchQuery): Promise<OptionRow[]> {
    const sql = await getSql();
    const rows = await sql`
      select * from gameday.watch_options(
        ${q.from}::timestamptz, ${q.to}::timestamptz,
        ${q.localTeams}::text[], ${q.spanish}, ${q.leagues?.length ? q.leagues : null}::text[])`;
    return rows.map((r) => ({ ...(r as unknown as OptionRow), start_utc: iso(r.start_utc) }));
  }

  async suggestLocalTeams(lat: number, lon: number): Promise<LocalTeam[]> {
    const sql = await getSql();
    const rows = await sql`select * from gameday.suggest_local_teams(${lat}, ${lon}, 160)`;
    return rows.map(toLocal);
  }

  async suggestLocalTeamsForZip(zip: string): Promise<LocalTeam[] | null> {
    const sql = await getSql();
    const known = await sql`select 1 from gameday_site.zip_centroids where zip = ${zip}`;
    if (!known.length) return null;
    const rows = await sql`select * from gameday_site.suggest_local_teams_for_zip(${zip}, 160)`;
    return rows.map(toLocal);
  }

  async saveZip(zip: string, lat: number, lon: number): Promise<void> {
    const sql = await getSql();
    await sql`insert into gameday_site.zip_centroids (zip, lat, lon) values (${zip}, ${lat}, ${lon}) on conflict (zip) do nothing`;
  }

  async searchTeams(q: string, limit: number): Promise<Team[]> {
    const sql = await getSql();
    const like = `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
    const rows = await sql`
      select id, league_id, name, short_name, abbreviation, color, alt_color, logo_url
      from gameday.teams
      where name ilike ${like} or abbreviation ilike ${q}
      order by (abbreviation ilike ${q}) desc,
               (league_id in ('nfl','nba','nhl','usa.1','eng.1','esp.1','ger.1','ita.1','fra.1')) desc,
               length(name), name
      limit ${limit}`;
    return rows as unknown as Team[];
  }

  async teamEvents(teamIds: string[], from: Date, to: Date): Promise<EventRow[]> {
    if (!teamIds.length) return [];
    const sql = await getSql();
    const rows = await sql`
      select ${sql.unsafe(EVENT_COLS)} from gameday.events
      where (home_team_id = any(${teamIds}::text[]) or away_team_id = any(${teamIds}::text[]))
        and start_utc >= ${from} and start_utc < ${to}
      order by start_utc`;
    return rows.map(toEvent);
  }

  async createPlan(p: NewPlan): Promise<{ slug: string }> {
    const sql = await getSql();
    for (let attempt = 0; attempt < 3; attempt++) {
      const slug = randomSlug();
      try {
        await sql.begin(async (tx) => {
          const [row] = await tx`
            insert into gameday_site.plans
              (share_slug, title, date_from, date_to, timezone, theme, area_label, local_team_ids, services, spanish, creator_ip_hash)
            values (${slug}, ${p.title}, ${p.dateFrom}, ${p.dateTo}, ${p.timezone}, ${p.theme}, ${p.areaLabel},
                    ${p.localTeamIds}::text[], ${p.services}::text[], ${p.spanish}, ${p.ipHash})
            returning id`;
          const items = p.items.map((i) => ({ plan_id: row.id as string, event_id: i.eventId, priority: i.priority }));
          if (items.length) await tx`insert into gameday_site.plan_items ${tx(items, "plan_id", "event_id", "priority")}`;
        });
        return { slug };
      } catch (e) {
        if (!String((e as Error).message).includes("share_slug")) throw e;
      }
    }
    throw new Error("Could not create a unique share link");
  }

  async getPlan(slug: string): Promise<StoredPlan | null> {
    const sql = await getSql();
    const [p] = await sql`
      select id, share_slug, title, date_from::text as date_from, date_to::text as date_to, timezone, theme, area_label,
             local_team_ids, services, spanish, created_at
      from gameday_site.plans where share_slug = ${slug}`;
    if (!p) return null;
    const items = await sql`select event_id, priority from gameday_site.plan_items where plan_id = ${p.id as string}`;
    return {
      id: String(p.id),
      slug: String(p.share_slug),
      title: (p.title as string) ?? null,
      dateFrom: dateOnly(p.date_from),
      dateTo: dateOnly(p.date_to),
      timezone: String(p.timezone),
      theme: p.theme as ThemeId,
      areaLabel: (p.area_label as string) ?? null,
      localTeamIds: (p.local_team_ids as string[]) ?? [],
      services: (p.services as string[]) ?? [],
      spanish: Boolean(p.spanish),
      items: items.map((i) => ({ eventId: String(i.event_id), priority: i.priority as "must" | "want" })),
      createdAt: iso(p.created_at),
    };
  }

  async countRecentPlans(ipHash: string): Promise<number> {
    const sql = await getSql();
    const [r] = await sql`
      select count(*)::int as n from gameday_site.plans
      where creator_ip_hash = ${ipHash} and created_at > now() - interval '1 hour'`;
    return num(r?.n ?? 0);
  }
}
