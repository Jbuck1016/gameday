import { NextResponse } from "next/server";
import { z } from "zod";
import { getSource, usingFixtures } from "@/lib/db/source";
import { buildGames } from "@/lib/games";
import { bad, csv, idList, serverError } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Q = z.object({ teams: idList.min(1).max(6), days: z.number().int().min(1).max(180) });

export async function GET(req: Request) {
  const u = new URL(req.url);
  const parsed = Q.safeParse({ teams: csv(u.searchParams.get("teams")), days: Number(u.searchParams.get("days") ?? 30) });
  if (!parsed.success) return bad("Pick 1 to 6 teams and up to 180 days");
  try {
    const src = await getSource();
    // fixture snapshot only covers one weekend, so start from it
    const from = usingFixtures() ? new Date("2026-10-23T07:00:00Z") : new Date(Date.now() - 6 * 3_600_000);
    const to = new Date(from.getTime() + parsed.data.days * 86_400_000);
    const [events, leagues] = await Promise.all([src.teamEvents(parsed.data.teams, from, to), src.leagues()]);
    const teamIds = Array.from(new Set(events.flatMap((e) => [e.home_team_id, e.away_team_id]).filter((x): x is string => Boolean(x))));
    const teams = await src.teamsByIds(teamIds);
    // options aren't loaded here (6 teams x 180 days stays fast); they're fetched when a day is opened
    const games = buildGames(events, teams, leagues, []);
    return NextResponse.json({ games }, { headers: { "cache-control": "public, s-maxage=600" } });
  } catch (e) {
    return serverError(e);
  }
}
