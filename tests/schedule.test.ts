import { describe, expect, it } from "vitest";
import { overlaps, peakScreens, segments } from "@/lib/schedule/overlap";
import { multiviewWindows, fillSuggestions } from "@/lib/schedule/multiview";
import { servicesNeeded } from "@/lib/schedule/services";
import { gameWindow } from "@/lib/schedule/duration";

const H = 3_600_000;

describe("overlap", () => {
  it("does not count touching edges as overlap", () => {
    expect(overlaps([{ id: "a", start: 0, end: 2 * H }, { id: "b", start: 2 * H, end: 4 * H }])).toEqual([]);
  });

  it("handles identical starts", () => {
    const o = overlaps([{ id: "a", start: 0, end: 2 * H }, { id: "b", start: 0, end: 3 * H }]);
    expect(o).toEqual([{ from: 0, to: 2 * H, ids: ["a", "b"] }]);
  });

  it("handles nesting and reports each distinct set", () => {
    const o = overlaps([
      { id: "outer", start: 0, end: 4 * H },
      { id: "inner", start: 1 * H, end: 2 * H },
    ]);
    expect(o).toEqual([{ from: 1 * H, to: 2 * H, ids: ["outer", "inner"] }]);
  });

  it("merges adjacent segments with the same games", () => {
    const o = overlaps([
      { id: "a", start: 0, end: 4 * H },
      { id: "b", start: 1 * H, end: 3 * H },
      { id: "c", start: 2 * H, end: 2.5 * H },
    ]);
    expect(o.map((s) => [s.from / H, s.to / H, s.ids.length])).toEqual([
      [1, 2, 2],
      [2, 2.5, 3],
      [2.5, 3, 2],
    ]);
  });

  it("computes peak screens", () => {
    expect(
      peakScreens([
        { id: "a", start: 0, end: 3 * H },
        { id: "b", start: 1 * H, end: 3 * H },
        { id: "c", start: 2 * H, end: 5 * H },
        { id: "d", start: 4 * H, end: 6 * H },
      ]),
    ).toBe(3);
  });

  it("ignores zero-length intervals", () => {
    expect(segments([{ id: "a", start: H, end: H }])).toEqual([]);
  });
});

describe("multiview", () => {
  // hand-worked example: 4 games, windows 10-11 (a,b), 11-12 (a,b,c), 12-13 (b,c)
  const games = [
    { id: "a", start: 10 * H, end: 12 * H, priority: "must" as const, services: ["peacock", "youtube_tv"] },
    { id: "b", start: 10 * H, end: 13 * H, priority: "want" as const, services: ["youtube_tv"] },
    { id: "c", start: 11 * H, end: 14 * H, priority: "must" as const, services: ["espn_plus"] },
    { id: "d", start: 15 * H, end: 16 * H, priority: "must" as const, services: ["youtube_tv"] },
  ];

  it("finds the windows and verdicts", () => {
    const w = multiviewWindows(games, ["youtube_tv"]);
    expect(w.map((x) => [x.from / H, x.to / H, x.gameIds, x.verdict])).toEqual([
      [10, 11, ["a", "b"], "single_service"],
      [11, 12, ["a", "c", "b"], "split"],
      [12, 13, ["c", "b"], "split"],
    ]);
    expect(w[0].commonServices).toEqual(["youtube_tv"]);
  });

  it("puts must-watch games first in the grid", () => {
    const w = multiviewWindows(games, []);
    expect(w[1].gameIds[0]).toBe("a");
    expect(w[1].gameIds[2]).toBe("b");
  });

  it("flags more than four and drops the latest wants first", () => {
    const five = [0, 1, 2, 3, 4].map((i) => ({
      id: `g${i}`,
      start: (10 + i * 0.1) * H,
      end: 14 * H,
      priority: (i < 2 ? "must" : "want") as "must" | "want",
      services: ["youtube_tv"],
    }));
    const w = multiviewWindows(five, []);
    const big = w.find((x) => x.gameIds.length === 5)!;
    expect(big.verdict).toBe("over_four");
    expect(big.drop).toEqual(["g4"]);
  });

  it("suggests fill games on the visitor's services covering half the window", () => {
    const w = multiviewWindows(games, ["youtube_tv"])[0];
    const fills = fillSuggestions(
      w,
      [
        { id: "x", start: 10 * H, end: 12 * H, services: ["youtube_tv"] },
        { id: "y", start: 10.8 * H, end: 12 * H, services: ["youtube_tv"] },
        { id: "z", start: 10 * H, end: 12 * H, services: ["dazn"] },
      ],
      ["youtube_tv"],
    );
    expect(fills).toEqual(["x"]);
  });
});

describe("services needed", () => {
  it("covers must-watch games first with the fewest services, preferring ones you have", () => {
    const r = servicesNeeded(
      [
        { id: "1", priority: "must", services: ["peacock", "youtube_tv"] },
        { id: "2", priority: "must", services: ["youtube_tv", "fubo"] },
        { id: "3", priority: "want", services: ["espn_plus"] },
        { id: "4", priority: "must", services: ["fubo", "hulu_live"] },
      ],
      ["hulu_live"],
    );
    // two services cover the three must-watch games, a third picks up the want
    expect(r.chosen.length).toBe(3);
    expect(r.chosen).toContain("espn_plus");
    const mustCovered = [["peacock", "youtube_tv"], ["youtube_tv", "fubo"], ["fubo", "hulu_live"]].every((svcs) =>
      svcs.some((s) => r.chosen.slice(0, 2).includes(s)),
    );
    expect(mustCovered).toBe(true);
    expect(r.mustNotCoveredByMine).toEqual(["1", "2"]);
  });

  it("breaks ties toward a service the visitor already has", () => {
    const r = servicesNeeded(
      [
        { id: "1", priority: "must", services: ["peacock", "youtube_tv"] },
        { id: "2", priority: "must", services: ["youtube_tv", "peacock"] },
      ],
      ["youtube_tv"],
    );
    expect(r.chosen).toEqual(["youtube_tv"]);
  });

  it("reports games no service carries", () => {
    const r = servicesNeeded([{ id: "x", priority: "must", services: [] }], []);
    expect(r.uncoverable).toEqual(["x"]);
    expect(r.chosen).toEqual([]);
  });
});

describe("duration", () => {
  it("uses the league default", () => {
    const w = gameWindow("2026-10-24T17:00:00Z", 115, "pre");
    expect((w.end - w.start) / 60000).toBe(115);
  });
  it("extends a live game that runs past its estimate", () => {
    const start = Date.parse("2026-10-24T17:00:00Z");
    const now = start + 200 * 60000;
    const w = gameWindow("2026-10-24T17:00:00Z", 150, "in", now);
    expect(w.runningLong).toBe(true);
    expect(w.end).toBe(now + 15 * 60000);
  });
});
