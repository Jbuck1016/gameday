import { ImageResponse } from "next/og";
import { loadGames } from "@/lib/server/load";
import { featuredGames } from "@/lib/featured";
import { bestWatch } from "@/lib/games";
import { fontsFor } from "@/lib/og/fonts";
import { dayParts, localDayRange, todayKey, zonedParts } from "@/lib/time";
import type { Game } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TZ = "America/New_York";

function et(ms: number): string {
  const p = zonedParts(ms, TZ);
  const h = p.hour % 12 === 0 ? 12 : p.hour % 12;
  return `${h}:${String(p.minute).padStart(2, "0")} ${p.hour >= 12 ? "PM" : "AM"}`;
}

function side(g: Game, home: boolean) {
  const t = home ? g.home : g.away;
  const r = home ? g.homeRank : g.awayRank;
  return `${r ? `#${r} ` : ""}${t?.short ?? ""}`;
}

/** Link-preview image for a day: the day's best games nationally, with channels. 1200x630. */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const q = u.searchParams.get("day");
  const day = q && /^\d{4}-\d{2}-\d{2}$/.test(q) ? q : todayKey(TZ);
  let picks: Game[] = [];
  try {
    const r = localDayRange(day, TZ);
    const games = await loadGames({ from: r.from, to: r.to, localTeams: [], spanish: false });
    picks = featuredGames(games, 0, 5).map((f) => f.game);
  } catch (e) {
    console.error(e);
  }
  const { weekday, date } = dayParts(day);
  const fonts = await fontsFor("daylight");
  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", width: 1200, height: 630, background: "#ffffff", color: "#111318", fontFamily: "Inter", padding: "48px 64px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div style={{ display: "flex", fontSize: 60, fontWeight: 800, letterSpacing: -2 }}>{`${weekday}'s best`}</div>
          <div style={{ display: "flex", fontSize: 28, color: "#5f6673", fontWeight: 500 }}>{`${date} · times ET`}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 24, borderTop: "2px solid #e6e8ec" }}>
          {picks.map((g) => {
            const best = bestWatch(g, []);
            const soccer = g.sport === "soccer";
            const a = soccer ? side(g, true) : side(g, false);
            const b = soccer ? side(g, false) : side(g, true);
            return (
              <div key={g.id} style={{ display: "flex", alignItems: "center", padding: "14px 0", borderBottom: "2px solid #e6e8ec" }}>
                <div style={{ display: "flex", width: 190, fontSize: 30, fontWeight: 700 }}>{g.timeValid ? et(Date.parse(g.start)) : "TBC"}</div>
                <div style={{ display: "flex", flex: 1, fontSize: 34, fontWeight: 600 }}>{`${a} ${soccer ? "v" : "at"} ${b}`}</div>
                <div style={{ display: "flex", fontSize: 28, fontWeight: 700, color: "#111318", background: "#f1f3f6", padding: "6px 16px", borderRadius: 10 }}>
                  {best ? (best.confidence === "likely" ? `${best.outlet}?` : best.outlet) : "TBA"}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", marginTop: "auto", justifyContent: "space-between", fontSize: 24, color: "#5f6673" }}>
          <div style={{ display: "flex" }}>Every game, where it airs in your area, and your day planned</div>
          <div style={{ display: "flex", fontWeight: 700, color: "#111318" }}>{u.host}</div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts,
      headers: { "cache-control": "public, s-maxage=1800, stale-while-revalidate=7200" },
    },
  );
}
