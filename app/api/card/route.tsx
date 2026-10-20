import { ImageResponse } from "next/og";
import { getSource } from "@/lib/db/source";
import { loadPlanGames } from "@/lib/server/load";
import { bad, serverError } from "@/lib/server/http";
import { buildDayModel, planDays } from "@/lib/plan";
import { DayCard, CARD_DIMENSIONS, type CardSize } from "@/lib/og/card";
import { fontsFor } from "@/lib/og/fonts";
import { THEMES, isThemeId } from "@/lib/themes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const slug = u.searchParams.get("plan") ?? "";
  const sizeParam = u.searchParams.get("size") ?? "portrait";
  const size: CardSize = sizeParam === "story" || sizeParam === "square" ? sizeParam : "portrait";
  if (!/^[A-Za-z0-9]{4,16}$/.test(slug)) return bad("Missing plan");
  try {
    const src = await getSource();
    const plan = await src.getPlan(slug);
    if (!plan) return bad("Plan not found", 404);
    const themeParam = u.searchParams.get("theme");
    const theme = THEMES[isThemeId(themeParam) ? themeParam : plan.theme];
    const games = await loadPlanGames(plan);
    const days = planDays(games.map((g) => g.start), plan.timezone);
    const dayParam = u.searchParams.get("day");
    const day = dayParam && days.includes(dayParam) ? dayParam : days[0] ?? plan.dateFrom;
    const priorities = new Map(plan.items.map((i) => [i.eventId, i.priority]));
    const model = buildDayModel(games, priorities, day, plan.timezone, plan.services);
    const dim = CARD_DIMENSIONS[size];
    const fonts = await fontsFor(theme.id);
    return new ImageResponse(<DayCard theme={theme} model={model} size={size} areaLabel={plan.areaLabel} />, {
      width: dim.width,
      height: dim.height,
      fonts,
      headers: {
        "cache-control": "public, s-maxage=300, stale-while-revalidate=3600",
        "content-disposition": `inline; filename="gameday-${day}-${theme.id}.png"`,
      },
    });
  } catch (e) {
    return serverError(e);
  }
}
