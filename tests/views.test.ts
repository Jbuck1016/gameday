import { describe, expect, it } from "vitest";
import { assignLanes, boardStatus, overlapBands } from "@/lib/views";
import type { Game } from "@/lib/types";

const H = 3_600_000;
const T0 = Date.parse("2026-10-31T16:00:00Z"); // 9:00 AM PT

function game(id: string, startH: number, durH: number, status: string | null = "pre"): Game {
  return {
    id, leagueId: "college-football", leagueShort: "CFB", leagueName: "College Football", sport: "football",
    start: new Date(T0 + startH * H).toISOString(), timeValid: true, status, name: id, home: null, away: null,
    homeRank: null, awayRank: null, venue: null, involvesLocal: false, durationMin: durH * 60, outlets: [],
  };
}

describe("assignLanes", () => {
  it("reuses a lane once its game has ended and stacks the ones that overlap", () => {
    const { lane, lanes } = assignLanes([
      { id: "a", start: 0, end: 210 },
      { id: "b", start: 0, end: 210 },
      { id: "c", start: 90, end: 205 },
      { id: "d", start: 210, end: 420 },
    ]);
    expect(lanes).toBe(3);
    expect(lane.get("d")).toBe(0);
    expect(new Set(["a", "b", "c"].map((id) => lane.get(id))).size).toBe(3);
  });
});

describe("overlapBands", () => {
  it("marks two and three at once, and nothing for a single game", () => {
    expect(
      overlapBands([
        { id: "a", start: 0, end: 100 },
        { id: "b", start: 50, end: 150 },
        { id: "c", start: 60, end: 90 },
        { id: "d", start: 300, end: 400 },
      ]),
    ).toEqual([
      { from: 50, to: 60, n: 2 },
      { from: 60, to: 90, n: 3 },
      { from: 90, to: 100, n: 2 },
    ]);
  });
});

describe("boardStatus", () => {
  const games = [game("early", 0, 3.5), game("feed-final", 1, 3.5, "post"), game("on", 3.5, 3.5), game("feed-live", 4, 2, "in"), game("next1", 5, 2), game("next2", 5, 3), game("late", 7.5, 3.5)];
  const s = boardStatus(games, T0 + 4.25 * H); // 1:15 PM PT

  it("finishes games by the clock or the feed", () => {
    expect(s.get("early")).toBe("final");
    expect(s.get("feed-final")).toBe("final");
  });
  it("shows games under way as live", () => {
    expect(s.get("on")).toBe("live");
    expect(s.get("feed-live")).toBe("live");
  });
  it("marks every game at the next kickoff time, and only those, as next", () => {
    expect(s.get("next1")).toBe("next");
    expect(s.get("next2")).toBe("next");
    expect(s.get("late")).toBe("later");
  });
});

describe("boardStatus with unconfirmed times", () => {
  it("never marks a TBC game live or next from its placeholder time", () => {
    const tbc = { ...game("tbc", -1, 3), timeValid: false };
    const st = boardStatus([tbc, game("b", 2, 3)], T0);
    expect(st.get("tbc")).toBe("later");
    expect(st.get("b")).toBe("next");
  });

  it("still trusts the feed's status for a TBC game", () => {
    expect(boardStatus([{ ...game("x", 5, 3, "in"), timeValid: false }], T0).get("x")).toBe("live");
  });

  it("handles an empty day", () => {
    expect(boardStatus([], T0).size).toBe(0);
  });
});

describe("timeline helpers", () => {
  it("labels gridlines by the local clock across the November clock change", async () => {
    const { hourLabel } = await import("@/components/views/TimelineView");
    const { localDayRange } = await import("@/lib/time");
    const start = localDayRange("2026-11-01", "America/Los_Angeles").from.getTime();
    // 14 hours after midnight on the day clocks go back is 1 PM, not 2 PM
    expect(hourLabel(start + 14 * H, "America/Los_Angeles", false)).toBe("1 PM");
    expect(hourLabel(start + 13 * H, "America/Los_Angeles", true)).toBe("12p");
  });

  it("caps a busy day at the planned games first, then the biggest", async () => {
    const { timelineGames, TIMELINE_MAX } = await import("@/components/views/TimelineView");
    const many = Array.from({ length: TIMELINE_MAX + 3 }, (_, i) => game(`g${i}`, i, 2));
    const out = timelineGames(many, (id) => (id === "g14" ? "must" : null));
    expect(out).toHaveLength(TIMELINE_MAX);
    expect(out.map((g) => g.id)).toContain("g14");
    expect(timelineGames(many.slice(0, 3), () => null)).toHaveLength(3);
  });
});

describe("freeLine", () => {
  it("says 'with an antenna' for over-the-air and 'on' for a free service", async () => {
    const { freeLine } = await import("@/lib/og/x/data");
    expect(freeLine({ games: 5, name: "Antenna" })).toBe("5 free with an antenna");
    expect(freeLine({ games: 2, name: "Fandango" })).toBe("2 free on Fandango");
  });
});

describe("clusterLanes", () => {
  it("gives a game that clashes with nothing the full width, whatever happens later", async () => {
    const { clusterLanes } = await import("@/lib/views");
    const c = clusterLanes([
      { id: "noon", start: 0, end: 100 },
      { id: "a", start: 200, end: 300 },
      { id: "b", start: 210, end: 300 },
      { id: "c", start: 220, end: 300 },
      { id: "d", start: 230, end: 300 },
      { id: "late", start: 300, end: 400 },
    ]);
    expect(c.width.get("noon")).toBe(1);
    expect(c.width.get("a")).toBe(4);
    expect(c.width.get("late")).toBe(1);
    expect(c.maxLanes).toBe(4);
    expect(new Set(["a", "b", "c", "d"].map((id) => c.lane.get(id))).size).toBe(4);
  });
});

describe("broadcastOutlet", () => {
  it("shows CBS rather than NFL Sunday Ticket on a national post", async () => {
    const { broadcastOutlet } = await import("@/lib/og/x/data");
    const g = {
      ...game("nfl", 0, 3),
      outlets: [
        { outlet: "NFL Sunday Ticket", confidence: "confirmed", services: [{ id: "nfl_sunday_ticket", name: "NFL Sunday Ticket", status: "direct" }] },
        { outlet: "CBS", confidence: "regional", services: [{ id: "antenna", name: "Antenna", status: "included" }, { id: "fubo", name: "Fubo", status: "included" }] },
      ],
    } as unknown as Game;
    expect(broadcastOutlet(g, "NFL Sunday Ticket")).toBe("CBS");
    expect(broadcastOutlet(g, "CBS")).toBeNull();
  });
});
