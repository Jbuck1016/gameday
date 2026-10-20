import { NextResponse } from "next/server";
import { z } from "zod";
import { getSource } from "@/lib/db/source";
import { bad, clientIp, idList, serverError, sha256 } from "@/lib/server/http";
import { isValidTimezone } from "@/lib/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  title: z.string().max(80).nullable().optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timezone: z.string().max(64).refine(isValidTimezone),
  theme: z.enum(["broadcast", "editorial", "terminal"]),
  areaLabel: z.string().max(80).nullable().optional(),
  localTeamIds: idList.max(20),
  services: z.array(z.string().regex(/^[a-z0-9_]+$/)).max(30),
  spanish: z.boolean(),
  items: z
    .array(z.object({ eventId: idList.element, priority: z.enum(["must", "want"]) }))
    .min(1)
    .max(60),
});

const LIMIT_PER_HOUR = 20;

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return bad("Invalid JSON");
  }
  const parsed = Body.safeParse(body);
  if (!parsed.success) return bad("Invalid plan");
  const p = parsed.data;
  if (p.dateTo < p.dateFrom) return bad("Invalid dates");
  try {
    const src = await getSource();
    const salt = process.env.IP_HASH_SALT ?? process.env.GAMEDAY_DB_PASSWORD ?? "gameday";
    const ipHash = await sha256(`${salt}:${clientIp(req)}`);
    if ((await src.countRecentPlans(ipHash)) >= LIMIT_PER_HOUR) {
      return bad("Too many shared plans from this connection. Try again in an hour.", 429);
    }
    const { slug } = await src.createPlan({
      title: p.title ?? null,
      dateFrom: p.dateFrom,
      dateTo: p.dateTo,
      timezone: p.timezone,
      theme: p.theme,
      areaLabel: p.areaLabel ?? null,
      localTeamIds: p.localTeamIds,
      services: p.services,
      spanish: p.spanish,
      items: p.items,
      ipHash,
    });
    return NextResponse.json({ slug });
  } catch (e) {
    return serverError(e);
  }
}
