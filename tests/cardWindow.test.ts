import { describe, expect, it } from "vitest";
import { cardWindow, type DayModel } from "@/lib/plan";
import { localDayRange } from "@/lib/time";

const TZ = "America/New_York";
const DAY = "2026-10-29";
const at = (h: number, m = 0) => localDayRange(DAY, TZ).from.getTime() + (h * 60 + m) * 60000;

function model(games: [number, number][]): DayModel {
  return {
    dayKey: DAY,
    tz: TZ,
    games: games.map(([s, e], i) => ({ start: s, end: e, game: { id: String(i) } }) as unknown as DayModel["games"][number]),
    windowStart: 7 * 60,
    windowEnd: 25 * 60,
    overlaps: [],
    peak: 0,
    cover: { chosen: [] } as unknown as DayModel["cover"],
    multiview: [],
  };
}

describe("cardWindow", () => {
  it("fits a night slate instead of starting at 7 AM", () => {
    expect(cardWindow(model([[at(19, 30), at(22)], [at(22), at(24, 30)]]))).toEqual({ start: 19 * 60, end: 25 * 60 });
  });
  it("keeps at least four hours for a single short game", () => {
    expect(cardWindow(model([[at(20), at(22)]]))).toEqual({ start: 20 * 60, end: 24 * 60 });
  });
  it("falls back to the model window with no games", () => {
    expect(cardWindow(model([]))).toEqual({ start: 7 * 60, end: 25 * 60 });
  });
});
