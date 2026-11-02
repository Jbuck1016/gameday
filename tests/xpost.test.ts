import { describe, expect, it } from "vitest";
import { clockText, composePost, inSlot, matchupText, slotFor, sportWord } from "@/lib/x/post";
import type { Game } from "@/lib/types";

const team = (short: string) => ({ id: short, name: short, short, abbr: short.slice(0, 3).toUpperCase(), color: null, altColor: null, logo: null }) as unknown as Game["home"];
function g(over: Partial<Game>): Game {
  return {
    id: "x:1", leagueId: "college-football", leagueShort: "CFB", leagueName: "College Football", sport: "football",
    start: "2026-10-31T16:00:00Z", timeValid: true, status: "pre", name: "A at B", home: team("Texas Tech"), away: team("Arizona"),
    homeRank: 13, awayRank: 22, venue: null, involvesLocal: false, durationMin: 210, outlets: [], ...over,
  };
}

describe("slotFor", () => {
  it("gives weekdays one noon-to-midnight slot", () => {
    expect(slotFor(new Date("2026-11-03T16:00:00Z"))).toMatchObject({ day: "2026-11-03", kind: "weekday", fromHour: 12, toHour: 24, weekday: "Tuesday" });
  });
  it("splits weekends into morning and afternoon by the ET clock, in winter and summer time", () => {
    expect(slotFor(new Date("2026-11-07T12:30:00Z"))).toMatchObject({ kind: "morning", weekday: "Saturday" }); // 7:30am EST
    expect(slotFor(new Date("2026-11-07T18:00:00Z"))).toMatchObject({ kind: "afternoon", weekday: "Saturday" }); // 1pm EST
    expect(slotFor(new Date("2026-10-31T12:30:00Z"))).toMatchObject({ kind: "morning", day: "2026-10-31" }); // 8:30am EDT
  });
});

describe("copy", () => {
  it("writes the matchup the way the posts do", () => {
    expect(matchupText(g({}))).toBe("#22 Arizona at #13 Texas Tech");
    expect(matchupText(g({ neutral: true, home: team("Georgia"), away: team("Florida"), homeRank: 3, awayRank: 17 }))).toBe("#17 Florida vs #3 Georgia");
    expect(matchupText(g({ sport: "soccer", home: team("Chelsea"), away: team("Man Utd"), homeRank: null, awayRank: null }))).toBe("Chelsea v Man Utd");
  });
  it("prints ET clock time without am/pm", () => {
    expect(clockText(Date.parse("2026-10-31T12:30:00Z"))).toBe("8:30");
    expect(clockText(Date.parse("2026-11-01T18:00:00Z"))).toBe("1:00"); // after the clocks went back
  });
  it("drops games from the end until the post fits 280 characters", () => {
    const lines = Array.from({ length: 12 }, (_, i) => `${i}:00 A long team name at another long team name (Paramount+)`);
    const { text, kept } = composePost("Saturday (ET)", lines);
    expect(text.length).toBeLessThanOrEqual(280);
    expect(kept).toBeGreaterThan(0);
    expect(kept).toBeLessThan(12);
  });
  it("names the sport only when every game shares it", () => {
    expect(sportWord([g({}), g({ id: "x:2" })])).toBe("college football");
    expect(sportWord([g({}), g({ leagueId: "nba", sport: "basketball" })])).toBe("");
    expect(sportWord([g({ sport: "soccer", leagueId: "eng.1" }), g({ sport: "soccer", leagueId: "ger.1" })])).toBe("soccer");
  });
});

describe("inSlot", () => {
  it("keeps a 1:30 ET kickoff in the morning post and a 3:30 one out", () => {
    const morning = { day: "2026-10-31", kind: "morning" as const, fromHour: 7, toHour: 14, weekday: "Saturday" };
    expect(inSlot(g({ start: "2026-10-31T17:30:00Z" }), morning)).toBe(true);
    expect(inSlot(g({ start: "2026-10-31T19:30:00Z" }), morning)).toBe(false);
  });
  it("counts a 10pm ET kickoff that is past midnight UTC in the day's afternoon post", () => {
    const aft = { day: "2026-10-30", kind: "weekday" as const, fromHour: 12, toHour: 24, weekday: "Friday" };
    expect(inSlot(g({ start: "2026-10-31T02:00:00Z" }), aft)).toBe(true);
  });
});
