import { createEvents, type EventAttributes } from "ics";
import { getSource } from "@/lib/db/source";
import { loadPlanGames } from "@/lib/server/load";
import { bad, serverError } from "@/lib/server/http";
import { bestWatch, matchupLabel } from "@/lib/games";
import { APP_NAME } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function utcArray(ms: number): [number, number, number, number, number] {
  const d = new Date(ms);
  return [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes()];
}

export async function GET(req: Request) {
  const slug = new URL(req.url).searchParams.get("plan") ?? "";
  if (!/^[A-Za-z0-9]{4,16}$/.test(slug)) return bad("Missing plan");
  try {
    const src = await getSource();
    const plan = await src.getPlan(slug);
    if (!plan) return bad("Plan not found", 404);
    const games = await loadPlanGames(plan);
    const pri = new Map(plan.items.map((i) => [i.eventId, i.priority]));
    const events: EventAttributes[] = games.map((g) => {
      const start = Date.parse(g.start);
      const best = bestWatch(g, plan.services);
      const where = best ? [best.outlet, best.service].filter(Boolean).join(" on ") : "Channel TBA";
      return {
        title: `${pri.get(g.id) === "must" ? "" : "(maybe) "}${matchupLabel(g)}`,
        start: utcArray(start),
        startInputType: "utc",
        startOutputType: "utc",
        end: utcArray(start + g.durationMin * 60_000),
        endInputType: "utc",
        endOutputType: "utc",
        location: where,
        description: `${g.leagueName}. Watch: ${where}. End time is an estimate.${g.timeValid ? "" : " Kickoff time not confirmed yet."}`,
        uid: `${g.id.replace(/[^a-zA-Z0-9]/g, "-")}@gameday`,
        productId: APP_NAME,
        calName: APP_NAME,
      };
    });
    const { error, value } = createEvents(events);
    if (error || !value) throw error ?? new Error("ics failed");
    return new Response(value, {
      headers: {
        "content-type": "text/calendar; charset=utf-8",
        "content-disposition": `attachment; filename="gameday-${plan.dateFrom}.ics"`,
      },
    });
  } catch (e) {
    return serverError(e);
  }
}
