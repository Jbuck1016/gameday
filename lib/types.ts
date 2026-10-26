// Shared types for Game Day. Rows mirror the gameday schema; Game is what the UI renders.

export type League = {
  id: string;
  sport: string;
  name: string;
  short_name: string;
  default_duration_min: number;
};

export type Service = { id: string; name: string; kind: string };

export type Team = {
  id: string;
  league_id: string;
  name: string;
  short_name: string | null;
  abbreviation: string | null;
  color: string | null;
  alt_color: string | null;
  logo_url: string | null;
};

export type EventRow = {
  id: string;
  league_id: string;
  start_utc: string;
  time_valid: boolean;
  status_state: string | null;
  home_team_id: string | null;
  away_team_id: string | null;
  name: string;
  short_name: string | null;
  venue: string | null;
  home_rank: number | null;
  away_rank: number | null;
};

export type Confidence = "confirmed" | "regional" | "likely" | "blacked_out";
export type OptionStatus = "included" | "direct" | "addon" | "unverified" | "not_available";
export type Basis = "national" | "local_team" | "out_of_market" | "likely";

/** One row of gameday.watch_options(). */
export type OptionRow = {
  event_id: string;
  league_id: string;
  start_utc: string;
  time_valid: boolean;
  event_name: string;
  home_team: string | null;
  away_team: string | null;
  involves_local_team: boolean;
  basis: Basis;
  outlet: string;
  service_id: string | null;
  service: string | null;
  status: OptionStatus | null;
  addon_name: string | null;
  confidence: Confidence;
  note: string | null;
};

export type LocalTeam = {
  team_id: string;
  league_id: string;
  team_name: string;
  city: string | null;
  distance_km: number;
};

export type TeamLite = {
  id: string;
  name: string;
  short: string;
  abbr: string;
  color: string | null;
  altColor: string | null;
  logo: string | null;
};

export type ServiceOption = {
  id: string;
  name: string;
  status: OptionStatus;
  addonName: string | null;
};

/** All services for one outlet on one game, with how sure we are. */
export type OutletOption = {
  outlet: string;
  basis: Basis;
  confidence: Confidence;
  note: string | null;
  services: ServiceOption[];
};

export type Game = {
  id: string;
  leagueId: string;
  leagueShort: string;
  leagueName: string;
  sport: string;
  start: string;
  timeValid: boolean;
  status: string | null;
  name: string;
  home: TeamLite | null;
  away: TeamLite | null;
  homeRank: number | null;
  awayRank: number | null;
  venue: string | null;
  involvesLocal: boolean;
  durationMin: number;
  outlets: OutletOption[];
};

export type Priority = "must" | "want";

export type PlanItem = {
  eventId: string;
  priority: Priority;
  start: string;
  leagueId: string;
  name: string;
};

export type ThemeId = "daylight" | "broadcast" | "editorial" | "terminal";

export type NewPlan = {
  title: string | null;
  dateFrom: string;
  dateTo: string;
  timezone: string;
  theme: ThemeId;
  areaLabel: string | null;
  localTeamIds: string[];
  services: string[];
  spanish: boolean;
  items: { eventId: string; priority: Priority }[];
  ipHash: string | null;
};

export type StoredPlan = {
  id: string;
  slug: string;
  title: string | null;
  dateFrom: string;
  dateTo: string;
  timezone: string;
  theme: ThemeId;
  areaLabel: string | null;
  localTeamIds: string[];
  services: string[];
  spanish: boolean;
  items: { eventId: string; priority: Priority }[];
  createdAt: string;
};

/** One analytics event as stored in gameday_site.events. */
export type TrackedEvent = {
  visitor: string;
  session: string;
  name: string;
  path: string | null;
  props: Record<string, string | number | boolean | null>;
  internal: boolean;
};

/** A subscribable calendar of a few teams' games, with channels for the subscriber's area. */
export type CalendarFeed = {
  token: string;
  teamIds: string[];
  localTeamIds: string[];
  services: string[];
  spanish: boolean;
  label: string | null;
};

/** Settings and plan saved to a signed-in visitor's account (same shape the browser keeps). */
export type AccountPrefs = {
  area: { label: string; source: "ip" | "zip"; zip: string | null; confirmed: boolean } | null;
  localTeams: { id: string; name: string; leagueId: string }[];
  services: string[];
  spanish: boolean;
  theme: ThemeId;
  tz: string;
  plan: PlanItem[];
};
