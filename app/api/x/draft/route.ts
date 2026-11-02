import { NextResponse } from "next/server";
import { loadGames } from "@/lib/server/load";
import { getSource } from "@/lib/db/source";
import { bad, serverError } from "@/lib/server/http";
import { bestWatch } from "@/lib/games";
import { featuredGames } from "@/lib/featured";
import { broadcastOutlet } from "@/lib/og/x/data";
import { localDayRange } from "@/lib/time";
import type { Game } from "@/lib/types";
import { MAX_GAMES, MIN_GAMES, POST_TZ, composePost, gameLine, groupOf, inSlot, isSlotKind, postTitle, slotFor, type Slot } from "@/lib/x/post";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The national channel to print for a game, or why the game can't be posted. */
function outletFor(g: Game): { outlet: string } | { reason: string } {
  const best = bestWatch(g, []);
  if (!best) return { reason: "no channel listed" };
  const name = broadcastOutlet(g, best.outlet) ?? best.outlet;
  const o = g.outlets.find((x) => x.outlet === name);
  if (!o) return { reason: "no channel listed" };
  if (o.confidence === "likely") return { reason: `channel not announced (${name} is a guess)` };
  if (o.confidence === "blacked_out") return { reason: "blacked out" };
  // a national post names national channels: a local station or an out-of-market package means nothing to most readers
  const onAir = o.services.some((s) => s.id === "antenna" && s.status === "included");
  if (o.basis !== "national" && !(o.confidence === "regional" && onAir)) return { reason: `only on a ${o.basis === "local_team" ? "local" : "non-national"} channel (${name})` };
  if (!o.services.some((s) => s.status === "included" || s.status === "direct")) return { reason: `${name} isn't mapped to any service` };
  // the feed can list several stations in one outlet ("KCOP-13; KTTV FOX 11"): post only clean single names
  if (name.includes(";")) return { reason: `ambiguous channel listing (${name})` };
  return { outlet: name };
}

/**
 * GET /api/x/draft[?day=YYYY-MM-DD&slot=weekday|morning|afternoon]
 * What the automated X poster should post now: the kill switch, the slot, and per sport group the
 * checked games with their copy line. Games that fail a check are listed under `dropped` with the reason.
 * Read-only; the poster creates the plan and the image itself.
 */
export async function GET(req: Request) {
  const u = new URL(req.url);
  // ?at=ISO time lets a test ask "what would have posted then"
  const at = u.searchParams.get("at");
  const now = at && !Number.isNaN(Date.parse(at)) ? new Date(at) : new Date();
  let slot: Slot = slotFor(now);
  const day = u.searchParams.get("day");
  const kind = u.searchParams.get("slot");
  if (day || kind) {
    if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day) || !isSlotKind(kind)) return bad("Give both day=YYYY-MM-DD and slot=weekday|morning|afternoon");
    const weekday = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "long" }).format(new Date(`${day}T12:00:00Z`));
    slot = kind === "weekday" ? { day, kind, fromHour: 12, toHour: 24, weekday } : kind === "morning" ? { day, kind, fromHour: 7, toHour: 14, weekday } : { day, kind, fromHour: 14, toHour: 24, weekday };
  }
  try {
    const src = await getSource();
    const enabled = await src.xPostingEnabled();
    const range = localDayRange(slot.day, POST_TZ);
    const all = await loadGames({ from: range.from, to: new Date(range.to.getTime() + 6 * 3600_000), localTeams: [], spanish: false });
    const soon = now.getTime() + 30 * 60_000;
    const dropped: { id: string; game: string; reason: string }[] = [];
    const ok: { game: Game; outlet: string }[] = [];
    for (const g of all) {
      if (!inSlot(g, slot)) continue;
      if (!g.timeValid) { dropped.push({ id: g.id, game: g.name, reason: "kickoff time not confirmed" }); continue; }
      if (g.status !== "pre" || Date.parse(g.start) < soon) continue; // started, or too close to post usefully
      const r = outletFor(g);
      if ("reason" in r) dropped.push({ id: g.id, game: g.name, reason: r.reason });
      else ok.push({ game: g, outlet: r.outlet });
    }
    const outletOf = new Map(ok.map((x) => [x.game.id, x.outlet]));
    const groups = (["soccer", "other"] as const).map((key) => {
      const pool = ok.filter((x) => groupOf(x.game) === key).map((x) => x.game);
      // Best's ranking within the group, allowing the whole post from one league (a college football Saturday);
      // no score floor, since the group is already limited to national, confirmed channels
      const picks = featuredGames(pool, now.getTime(), MAX_GAMES, MAX_GAMES, 0, 50, MAX_GAMES).map((f) => f.game);
      return { key, picks };
    });
    const posting = groups.filter((g) => g.picks.length >= MIN_GAMES);
    const split = posting.length > 1;
    const posts = posting.map(({ key, picks }) => {
      const title = postTitle(slot, picks, split);
      const { text, kept } = composePost(title, picks.map((g) => gameLine(g, outletOf.get(g.id)!)));
      const games = picks.slice(0, kept).map((g) => ({ id: g.id, start: g.start, path: `${g.sport}/${g.leagueId}`, name: g.name, outlet: outletOf.get(g.id)!, line: gameLine(g, outletOf.get(g.id)!) }));
      return { group: key, title, text, games };
    });
    const skipped = groups.filter((g) => g.picks.length < MIN_GAMES).map((g) => ({ group: g.key, games: g.picks.length }));
    return NextResponse.json({ enabled, slot, posts, skipped, dropped, generatedAt: now.toISOString() }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return serverError(e);
  }
}
