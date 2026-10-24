import { getSource } from "@/lib/db/source";
import { buildFeedIcs, feedGames } from "@/lib/server/feed";
import { isValidTimezone } from "@/lib/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Subscribable calendar: /cal/<token>.ics (webcal:// works too). Calendar apps poll it. */
export async function GET(req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const m = /^([A-Za-z0-9]{16,32})\.ics$/.exec(file);
  if (!m) return new Response("Not found", { status: 404 });
  const u = new URL(req.url);
  const tzParam = u.searchParams.get("tz");
  const tz = tzParam && isValidTimezone(tzParam) ? tzParam : "America/Los_Angeles";
  try {
    const src = await getSource();
    const feed = await src.getFeed(m[1]);
    if (!feed) return new Response("Calendar not found", { status: 404 });
    const games = await feedGames(feed);
    const body = buildFeedIcs(games, feed, u.origin, tz);
    return new Response(body, {
      headers: {
        "content-type": "text/calendar; charset=utf-8",
        "content-disposition": `inline; filename="gameday.ics"`,
        "cache-control": "public, max-age=900, s-maxage=1800, stale-while-revalidate=3600",
      },
    });
  } catch (e) {
    console.error(e);
    return new Response("Calendar temporarily unavailable", { status: 503, headers: { "retry-after": "600" } });
  }
}
