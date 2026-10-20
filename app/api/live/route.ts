import { NextResponse } from "next/server";
import { getSource, usingFixtures } from "@/lib/db/source";
import { csv, idList, serverError } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ESPN = "https://site.api.espn.com/apis/site/v2/sports";

type Live = { id: string; state: string; detail: string | null };

/** Live status for plan games: read the day's ESPN scoreboard (cached 60s) for each league involved. */
export async function GET(req: Request) {
  const parsed = idList.max(60).safeParse(csv(new URL(req.url).searchParams.get("ids")));
  if (!parsed.success || !parsed.data.length) return NextResponse.json({ live: [] });
  if (usingFixtures()) return NextResponse.json({ live: [] });
  try {
    const src = await getSource();
    const leagues = await src.leagues();
    const wanted = new Set(parsed.data);
    const byLeague = new Map<string, Set<string>>();
    for (const id of parsed.data) {
      const [lg] = id.split(":");
      if (!byLeague.has(lg)) byLeague.set(lg, new Set());
    }
    const day = new Date();
    const keys = [0, -1].map((o) => {
      const d = new Date(day.getTime() + o * 86_400_000);
      return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
    });
    const out: Live[] = [];
    await Promise.all(
      Array.from(byLeague.keys()).flatMap((lg) => {
        const meta = leagues.find((l) => l.id === lg);
        if (!meta) return [];
        const path = lg === "college-football" ? "football/college-football" : lg === "mens-college-basketball" ? "basketball/mens-college-basketball" : `${meta.sport}/${lg}`;
        return keys.map(async (k) => {
          const res = await fetch(`${ESPN}/${path}/scoreboard?dates=${k}`, { next: { revalidate: 60 } }).catch(() => null);
          if (!res?.ok) return;
          const j = (await res.json().catch(() => null)) as { events?: { id: string; competitions?: { status?: { type?: { state?: string; shortDetail?: string } } }[] }[] } | null;
          for (const ev of j?.events ?? []) {
            const id = `${lg}:${ev.id}`;
            if (!wanted.has(id)) continue;
            const st = ev.competitions?.[0]?.status?.type;
            out.push({ id, state: st?.state ?? "pre", detail: st?.shortDetail ?? null });
          }
        });
      }),
    );
    return NextResponse.json({ live: out }, { headers: { "cache-control": "public, s-maxage=60" } });
  } catch (e) {
    return serverError(e);
  }
}
