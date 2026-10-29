import { describe, expect, it } from "vitest";
import fixture from "@/fixtures/weekend-2026-10-24.json";
import { buildGames } from "@/lib/games";
import { featuredGames, scoreGame } from "@/lib/featured";
import { buildFeedIcs, feedEvent, watchLines } from "@/lib/server/feed";
import type { CalendarFeed, EventRow, Game, League, OptionRow, Team } from "@/lib/types";

const F = fixture as unknown as { events: EventRow[]; teams: Team[]; leagues: League[]; options: OptionRow[] };
const all = buildGames(F.events, F.teams, F.leagues, F.options);
const sat = all.filter((g) => g.start >= "2026-10-24T07:00" && g.start < "2026-10-25T07:00");
const byName = (re: RegExp) => all.find((g) => re.test(g.name))!;

describe("best games of the day", () => {
  const picks = featuredGames(sat, 0);

  it("returns a short list, in kickoff order", () => {
    expect(picks.length).toBeGreaterThanOrEqual(4);
    expect(picks.length).toBeLessThanOrEqual(6);
    const starts = picks.map((p) => Date.parse(p.game.start));
    expect([...starts].sort((a, b) => a - b)).toEqual(starts);
  });

  it("caps each league: two ordinary games, a third only if it stands out", () => {
    const byLeague = new Map<string, number[]>();
    for (const p of picks) if (!p.game.involvesLocal) byLeague.set(p.game.leagueId, [...(byLeague.get(p.game.leagueId) ?? []), p.score]);
    for (const scores of byLeague.values()) {
      expect(scores.length).toBeLessThanOrEqual(3);
      if (scores.length === 3) expect(Math.min(...scores)).toBeGreaterThanOrEqual(50);
    }
  });

  it("ranks a ranked college game on network TV above an unranked streaming-only one", () => {
    const big = scoreGame(byName(/Indiana Hoosiers at Michigan/), 0)!;
    const small = sat
      .filter((g) => g.leagueId === "college-football" && g.homeRank == null && g.awayRank == null)
      .map((g) => scoreGame(g, 0)!)
      .find((f) => f.reasons.length === 0)!;
    expect(big.score).toBeGreaterThan(small.score);
    expect(big.reasons.join(" ")).toMatch(/#\d+/);
  });

  it("always includes local-team games and says why", () => {
    const local = sat.filter((g) => g.involvesLocal);
    expect(local.length).toBeGreaterThan(0);
    const s = scoreGame(local[0], 0)!;
    expect(s.reasons[0]).toBe("Your team");
  });

  it("drops games that have already finished", () => {
    const g = sat[0];
    const after = Date.parse(g.start) + (g.durationMin + 5) * 60_000;
    expect(scoreGame(g, after)).toBeNull();
    expect(scoreGame({ ...g, status: "post" } as Game, 0)).toBeNull();
  });
});

describe("calendar feed", () => {
  const feed: CalendarFeed = { token: "x".repeat(20), teamIds: ["eng.1:359"], localTeamIds: [], services: ["peacock"], spanish: false, label: "Arsenal" };

  it("puts the channel in the title and every option in the description", () => {
    const g = byName(/Everton at Arsenal/);
    const e = feedEvent(g, feed, "https://example.test", "America/Los_Angeles");
    expect(e.title).toMatch(/^Arsenal v Everton/);
    expect(String(e.description)).toMatch(/Where to watch/);
    expect(String(e.url)).toBe("https://example.test/?day=2026-10-24");
    expect(e.uid).toMatch(/@gameday$/);
  });

  it("marks unannounced channels as likely", () => {
    const g = byName(/Everton at Arsenal/);
    expect(watchLines(g, []).some((l) => /likely, not announced/.test(l))).toBe(true);
  });

  it("builds a valid calendar that asks to be refreshed", () => {
    const ics = buildFeedIcs(sat.slice(0, 5), feed, "https://example.test", "America/Los_Angeles");
    expect(ics.startsWith("BEGIN:VCALENDAR")).toBe(true);
    expect(ics).toContain("REFRESH-INTERVAL;VALUE=DURATION:PT6H");
    expect(ics).toContain("X-WR-CALNAME:Game Day: Arsenal");
    expect(ics.match(/BEGIN:VEVENT/g)?.length).toBe(5);
    expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
  });

  it("still builds a calendar when the teams have no games", () => {
    const ics = buildFeedIcs([], feed, "https://example.test", "America/Los_Angeles");
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).not.toContain("BEGIN:VEVENT");
  });
});

describe("best games: ranked teams", () => {
  const T = Date.parse("2026-10-31T16:00:00Z");
  const g = (id: string, h: number, homeRank: number | null, awayRank: number | null, net: string): Game => ({
    id, leagueId: "college-football", leagueShort: "CFB", leagueName: "College Football", sport: "football",
    start: new Date(T + h * 3_600_000).toISOString(), timeValid: true, status: "pre", name: id, home: null, away: null,
    homeRank, awayRank, venue: null, involvesLocal: false, durationMin: 210,
    outlets: [{ outlet: net, basis: "national", confidence: "confirmed", note: null, services: [] }],
  });

  it("puts the #1 and #2 teams ahead of a #13 v #22 game when the league cap bites", () => {
    // Saturday 31 Oct: the three college slots went to UGA-FLA, ARIZ-TTU and ND-Navy, leaving out #1 and #2
    const day = [g("fla-uga", 3.5, 3, 17, "ABC"), g("ariz-ttu", 0, 13, 22, "ESPN"), g("nd-navy", 0, null, 5, "ABC"), g("osu-usc", 7.5, null, 2, "NBC"), g("mia-unc", 7.5, null, 1, "ABC")];
    const ids = featuredGames(day, 0).map((f) => f.game.id);
    expect(ids).toEqual(expect.arrayContaining(["fla-uga", "osu-usc", "mia-unc"]));
    expect(ids).not.toContain("ariz-ttu");
  });
});

describe("single-ranked scoring", () => {
  it("never scores a top-10 team below a flat 16, and ranks #1 above #10", () => {
    const base = { leagueId: "college-football", sport: "football", status: "pre", start: "2026-10-31T19:30:00Z", timeValid: true, durationMin: 210, outlets: [], involvesLocal: false, homeRank: null } as const;
    const s = (r: number) => scoreGame({ ...(base as object), id: `r${r}`, awayRank: r } as never, 0)?.score ?? 0;
    expect(s(1)).toBeGreaterThan(s(10));
    expect(s(10) - s(20)).toBeGreaterThanOrEqual(6);
  });
});
