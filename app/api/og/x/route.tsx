import { ImageResponse } from "next/og";
import type { ReactElement } from "react";
import { getSource } from "@/lib/db/source";
import { loadPlanGames } from "@/lib/server/load";
import { bad, serverError } from "@/lib/server/http";
import { fontsFor } from "@/lib/og/fonts";
import { X_H, X_W, buildXData, type XData } from "@/lib/og/x/data";
import { DeparturesCover, DeparturesCrunch, DeparturesSlate } from "@/lib/og/x/departures";
import { GridCover, GridCrunch, GridSlate } from "@/lib/og/x/grid";
import { CardCover, CardCrunch, CardSlate } from "@/lib/og/x/card";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Kind = "slate" | "crunch" | "cover";
type Look = "departures" | "grid" | "card";

const LOOKS: Record<Look, Record<Kind, (p: { d: XData }) => ReactElement>> = {
  departures: { slate: DeparturesSlate, crunch: DeparturesCrunch, cover: DeparturesCover },
  grid: { slate: GridSlate, crunch: GridCrunch, cover: GridCover },
  card: { slate: CardSlate, crunch: CardCrunch, cover: CardCover },
};

async function fontsForLook(look: Look) {
  const inter = await fontsFor("daylight");
  if (look === "departures") return [...(await fontsFor("terminal")), ...inter];
  if (look === "card") return [...(await fontsFor("broadcast")), ...inter];
  return inter;
}

/** 1600x900 post graphics for X from a shared plan: ?plan=SLUG&kind=slate|crunch|cover&look=departures|grid|card */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const slug = u.searchParams.get("plan") ?? "";
  if (!/^[A-Za-z0-9]{4,16}$/.test(slug)) return bad("Missing plan");
  const kindQ = u.searchParams.get("kind");
  const lookQ = u.searchParams.get("look");
  const kind: Kind = kindQ === "crunch" || kindQ === "cover" ? kindQ : "slate";
  const look: Look = lookQ === "departures" || lookQ === "card" ? lookQ : "grid";
  try {
    const src = await getSource();
    const plan = await src.getPlan(slug);
    if (!plan) return bad("Plan not found", 404);
    const games = await loadPlanGames(plan);
    const [d, fonts] = await Promise.all([buildXData(plan, games, u.searchParams.get("day"), u.host), fontsForLook(look)]);
    const View = LOOKS[look][kind];
    return new ImageResponse(<View d={d} />, {
      width: X_W,
      height: X_H,
      fonts,
      headers: {
        "cache-control": "public, s-maxage=300, stale-while-revalidate=3600",
        "content-disposition": `inline; filename="gameday-${d.dayKey}-${kind}-${look}.png"`,
      },
    });
  } catch (e) {
    return serverError(e);
  }
}
