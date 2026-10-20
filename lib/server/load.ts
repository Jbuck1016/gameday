import "server-only";
import { getSource, usingFixtures } from "@/lib/db/source";
import { buildGames } from "@/lib/games";
import type { Game, StoredPlan } from "@/lib/types";
import { addDays, localDayRange } from "@/lib/time";

export type GamesQuery = {
  from: Date;
  to: Date;
  localTeams: string[];
  spanish: boolean;
  leagues?: string[] | null;
  ids?: string[] | null;
};

export async function loadGames(q: GamesQuery): Promise<Game[]> {
  const src = await getSource();
  const [events, options, leagues] = await Promise.all([
    src.events({ from: q.from, to: q.to, leagues: q.leagues, ids: q.ids }),
    src.watchOptions({ from: q.from, to: q.to, localTeams: q.localTeams, spanish: q.spanish, leagues: q.leagues }),
    src.leagues(),
  ]);
  const teamIds = Array.from(
    new Set(events.flatMap((e) => [e.home_team_id, e.away_team_id]).filter((x): x is string => Boolean(x))),
  );
  const teams = await src.teamsByIds(teamIds);
  return buildGames(events, teams, leagues, options);
}

/** Games in a shared plan, for its whole date range, as the plan's owner would see them. */
export async function loadPlanGames(plan: StoredPlan): Promise<Game[]> {
  const from = localDayRange(plan.dateFrom, plan.timezone).from;
  const to = localDayRange(addDays(plan.dateTo, 0), plan.timezone).to;
  const ids = plan.items.map((i) => i.eventId);
  if (!ids.length) return [];
  return loadGames({ from, to, localTeams: plan.localTeamIds, spanish: plan.spanish, ids });
}

export function isFixtureMode(): boolean {
  return usingFixtures();
}
