// Which services does this plan need? Greedy set cover: must-watch games first, then wants.
// Ties prefer services the visitor already has, then free ones, then the one that also carries
// more of the later (want) games, so the must pass doesn't pick a service the wants can't use.

import type { Priority } from "@/lib/types";

export type CoverGame = { id: string; priority: Priority; services: string[] };

export const FREE_SERVICES = new Set(["antenna", "fandango", "youtube_free"]);

export type CoverResult = {
  chosen: string[];
  /** must-watch games that none of the visitor's services carry (only when they've set services) */
  mustNotCoveredByMine: string[];
  /** games no known service carries at all */
  uncoverable: string[];
};

function greedy(games: CoverGame[], mine: Set<string>, already: string[], later: CoverGame[] = []): string[] {
  const chosen = [...already];
  let remaining = games.filter((g) => !g.services.some((s) => chosen.includes(s)) && g.services.length > 0);
  while (remaining.length) {
    const score = new Map<string, number>();
    for (const g of remaining) for (const s of g.services) score.set(s, (score.get(s) ?? 0) + 1);
    let best: string | null = null;
    let bestScore = -1;
    for (const [s, n] of score) {
      // later-game coverage only breaks ties: at most 0.2 in total, below the free-service bonus
      const reach = later.length ? (later.filter((g) => g.services.includes(s)).length / later.length) * 0.2 : 0;
      const bonus = (mine.has(s) ? 0.5 : 0) + (FREE_SERVICES.has(s) ? 0.25 : 0) + reach;
      const v = n + bonus;
      if (v > bestScore || (v === bestScore && best !== null && s < best)) {
        best = s;
        bestScore = v;
      }
    }
    if (!best) break;
    chosen.push(best);
    remaining = remaining.filter((g) => !g.services.includes(best!));
  }
  return chosen;
}

export function servicesNeeded(games: CoverGame[], myServices: string[]): CoverResult {
  const mine = new Set(myServices);
  const must = games.filter((g) => g.priority === "must");
  const want = games.filter((g) => g.priority === "want");
  const afterMust = greedy(must, mine, [], want);
  const chosen = greedy(want, mine, afterMust);
  return {
    chosen,
    mustNotCoveredByMine:
      myServices.length === 0 ? [] : must.filter((g) => !g.services.some((s) => mine.has(s))).map((g) => g.id),
    uncoverable: games.filter((g) => g.services.length === 0).map((g) => g.id),
  };
}
