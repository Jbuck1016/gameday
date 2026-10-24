// The data layer the site talks to. Production reads Postgres as the gameday_web role;
// local development and tests read a snapshot of real data from fixtures/.

import type { AccountPrefs, CalendarFeed, EventRow, League, LocalTeam, NewPlan, OptionRow, Service, StoredPlan, Team, TrackedEvent } from "@/lib/types";

export type EventQuery = { from: Date; to: Date; leagues?: string[] | null; ids?: string[] | null };
export type WatchQuery = { from: Date; to: Date; localTeams: string[]; spanish: boolean; leagues?: string[] | null };

export interface DataSource {
  readonly kind: "postgres" | "fixtures";
  leagues(): Promise<League[]>;
  services(): Promise<Service[]>;
  events(q: EventQuery): Promise<EventRow[]>;
  teamsByIds(ids: string[]): Promise<Team[]>;
  watchOptions(q: WatchQuery): Promise<OptionRow[]>;
  suggestLocalTeams(lat: number, lon: number): Promise<LocalTeam[]>;
  /** null when the zip isn't in the lookup table yet */
  suggestLocalTeamsForZip(zip: string): Promise<LocalTeam[] | null>;
  saveZip(zip: string, lat: number, lon: number): Promise<void>;
  searchTeams(q: string, limit: number): Promise<Team[]>;
  teamEvents(teamIds: string[], from: Date, to: Date): Promise<EventRow[]>;
  createPlan(p: NewPlan): Promise<{ slug: string }>;
  getPlan(slug: string): Promise<StoredPlan | null>;
  countRecentPlans(ipHash: string): Promise<number>;
  logEvents(events: TrackedEvent[]): Promise<void>;
  createFeed(f: Omit<CalendarFeed, "token">, visitor: string | null, userId?: string | null): Promise<{ token: string }>;
  /** Looks up a feed and records the fetch (calendar apps poll this). */
  getFeed(token: string): Promise<CalendarFeed | null>;
  getAccountPrefs(userId: string): Promise<{ prefs: AccountPrefs; updatedAt: string } | null>;
  saveAccountPrefs(userId: string, p: AccountPrefs): Promise<string>;
  linkVisitor(userId: string, visitor: string): Promise<void>;
  deleteAccount(userId: string): Promise<void>;
}

export function usingFixtures(): boolean {
  if (process.env.GAMEDAY_FIXTURES === "1") return true;
  return !process.env.GAMEDAY_DATABASE_URL && !(process.env.GAMEDAY_DB_USER && process.env.GAMEDAY_DB_PASSWORD);
}

let cached: DataSource | null = null;

export async function getSource(): Promise<DataSource> {
  if (cached) return cached;
  if (usingFixtures()) {
    const { FixtureSource } = await import("./fixtures");
    cached = new FixtureSource();
  } else {
    const { PgSource } = await import("./pg");
    cached = new PgSource();
  }
  return cached;
}

export function randomSlug(len = 8): string {
  const alphabet = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}
