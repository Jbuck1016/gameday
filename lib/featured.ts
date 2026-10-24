// "Best games today": a short, explainable pick of the day's games for someone who just landed.
// Signals: your local teams, rankings, which network chose the game (broadcast networks and the big
// national cable slots pick the biggest games), and the competition. Capped per league so one sport
// can't take the whole list.

import type { Game } from "@/lib/types";

export type Featured = { game: Game; score: number; reasons: string[] };

const LEAGUE_WEIGHT: Record<string, number> = {
  "uefa.champions": 26,
  nfl: 26,
  "eng.1": 22,
  nba: 18,
  "college-football": 14,
  "esp.1": 14,
  "ger.1": 12,
  "ita.1": 12,
  nhl: 10,
  "usa.1": 10,
  "fra.1": 8,
  "mens-college-basketball": 8,
};

const LEAGUE_LABEL: Record<string, string> = {
  "uefa.champions": "Champions League",
  nfl: "NFL",
};

// broadcast networks and the major national cable/streaming windows
const NETWORK_WEIGHT: Record<string, number> = {
  ABC: 24,
  CBS: 24,
  NBC: 24,
  FOX: 24,
  ESPN: 14,
  TNT: 14,
  "Prime Video": 14,
  "NFL Network": 14,
  Netflix: 14,
  "USA Network": 10,
  TBS: 10,
  ESPN2: 7,
  FS1: 7,
  "NBC Sports Network": 7,
  "NBA TV": 6,
  truTV: 5,
};

const BIG_NETWORKS = new Set(["ABC", "CBS", "NBC", "FOX", "ESPN", "TNT", "Prime Video", "NFL Network", "Netflix"]);

export function scoreGame(g: Game, nowMs: number): Featured | null {
  if (g.status === "post") return null;
  const end = Date.parse(g.start) + g.durationMin * 60_000;
  if (end <= nowMs) return null;

  const reasons: string[] = [];
  let score = LEAGUE_WEIGHT[g.leagueId] ?? 6;

  if (g.involvesLocal) {
    score += 60;
    reasons.push("Your team");
  }

  const ranks = [g.homeRank, g.awayRank].filter((r): r is number => r != null);
  if (ranks.length === 2) {
    score += 30 + (ranks.some((r) => r <= 10) ? 8 : 0);
    reasons.push(`#${Math.min(...ranks)} v #${Math.max(...ranks)}`);
  } else if (ranks.length === 1) {
    score += 10 + (ranks[0] <= 10 ? 6 : 0);
    reasons.push(`#${ranks[0]} in action`);
  }

  let net = 0;
  let netName: string | null = null;
  for (const o of g.outlets) {
    if (o.basis !== "national" || o.confidence !== "confirmed") continue;
    const w = NETWORK_WEIGHT[o.outlet] ?? 0;
    if (w > net) {
      net = w;
      netName = o.outlet;
    }
  }
  score += net;
  if (netName && BIG_NETWORKS.has(netName)) reasons.push(`National TV: ${netName}`);

  if (LEAGUE_LABEL[g.leagueId] && reasons.length < 2) reasons.push(LEAGUE_LABEL[g.leagueId]);

  if (Date.parse(g.start) <= nowMs) {
    score += 4;
    reasons.unshift("On now");
  }
  if (!g.timeValid) score -= 10;

  return { game: g, score, reasons: reasons.slice(0, 2) };
}

/** Top picks for the day: per league, at most `perLeague` ordinary games or `hardCap` standout ones; nothing below `minScore`. */
export function featuredGames(games: Game[], nowMs: number, max = 6, perLeague = 2, minScore = 30, strong = 50, hardCap = 3): Featured[] {
  const scored = games
    .map((g) => scoreGame(g, nowMs))
    .filter((f): f is Featured => f !== null && f.score >= minScore)
    .sort((a, b) => b.score - a.score || Date.parse(a.game.start) - Date.parse(b.game.start));
  const out: Featured[] = [];
  const perL = new Map<string, number>();
  for (const f of scored) {
    const n = perL.get(f.game.leagueId) ?? 0;
    // local teams and standout games make it whatever the league count
    if (!f.game.involvesLocal && (n >= hardCap || (n >= perLeague && f.score < strong))) continue;
    out.push(f);
    perL.set(f.game.leagueId, n + 1);
    if (out.length >= max) break;
  }
  return out.sort((a, b) => Date.parse(a.game.start) - Date.parse(b.game.start));
}
