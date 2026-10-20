import { NextResponse } from "next/server";
import { z } from "zod";
import { loadGames } from "@/lib/server/load";
import { bad, csv, idList, serverError } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Q = z.object({
  from: z.string().datetime({ offset: true }),
  to: z.string().datetime({ offset: true }),
  teams: idList,
  leagues: z.array(z.string().regex(/^[a-z0-9.\-]+$/)).max(20),
  ids: idList,
  spanish: z.boolean(),
});

export async function GET(req: Request) {
  const u = new URL(req.url);
  const parsed = Q.safeParse({
    from: u.searchParams.get("from"),
    to: u.searchParams.get("to"),
    teams: csv(u.searchParams.get("teams")),
    leagues: csv(u.searchParams.get("leagues")),
    ids: csv(u.searchParams.get("ids")),
    spanish: u.searchParams.get("spanish") === "1",
  });
  if (!parsed.success) return bad("Invalid query");
  const q = parsed.data;
  const from = new Date(q.from);
  const to = new Date(q.to);
  const maxDays = q.ids.length ? 32 : 8;
  if (to <= from || to.getTime() - from.getTime() > maxDays * 86_400_000) return bad("Date range too large");
  try {
    const games = await loadGames({
      from,
      to,
      localTeams: q.teams,
      spanish: q.spanish,
      leagues: q.leagues.length ? q.leagues : null,
      ids: q.ids.length ? q.ids : null,
    });
    return NextResponse.json(
      { games, generatedAt: new Date().toISOString() },
      { headers: { "cache-control": "public, s-maxage=120, stale-while-revalidate=600" } },
    );
  } catch (e) {
    return serverError(e);
  }
}
