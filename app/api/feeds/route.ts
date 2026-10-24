import { NextResponse } from "next/server";
import { z } from "zod";
import { getSource } from "@/lib/db/source";
import { bad, idList, serverError } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  teamIds: idList.min(1).max(6),
  localTeamIds: idList.max(20),
  services: z.array(z.string().regex(/^[a-z0-9_]+$/)).max(30),
  spanish: z.boolean(),
  label: z.string().max(120).nullable(),
  visitor: z.string().regex(/^[A-Za-z0-9]{8,32}$/).nullable().optional(),
});

/** Create a calendar subscription for a set of teams; returns the token for /cal/<token>.ics. */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return bad("Invalid JSON");
  }
  const parsed = Body.safeParse(body);
  if (!parsed.success) return bad("Invalid calendar request");
  const b = parsed.data;
  try {
    const src = await getSource();
    const { token } = await src.createFeed(
      { teamIds: b.teamIds, localTeamIds: b.localTeamIds, services: b.services, spanish: b.spanish, label: b.label },
      b.visitor ?? null,
    );
    return NextResponse.json({ token, path: `/cal/${token}.ics` });
  } catch (e) {
    return serverError(e);
  }
}
