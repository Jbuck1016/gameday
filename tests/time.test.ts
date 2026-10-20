import { describe, expect, it } from "vitest";
import { addDays, dateKey, localDayRange, minutesIntoDay, zonedToUtc } from "@/lib/time";
import { THEMES } from "@/lib/themes";

describe("local days", () => {
  it("a normal LA day is 24 hours", () => {
    const r = localDayRange("2026-10-24", "America/Los_Angeles");
    expect(r.from.toISOString()).toBe("2026-10-24T07:00:00.000Z");
    expect((r.to.getTime() - r.from.getTime()) / 3_600_000).toBe(24);
  });

  it("the US fall-back day (first Sunday of November) is 25 hours", () => {
    const r = localDayRange("2026-11-01", "America/Los_Angeles");
    expect(r.from.toISOString()).toBe("2026-11-01T07:00:00.000Z");
    expect(r.to.toISOString()).toBe("2026-11-02T08:00:00.000Z");
    expect((r.to.getTime() - r.from.getTime()) / 3_600_000).toBe(25);
  });

  it("the US spring-forward day is 23 hours", () => {
    const r = localDayRange("2027-03-14", "America/New_York");
    expect((r.to.getTime() - r.from.getTime()) / 3_600_000).toBe(23);
  });

  it("puts a UK lunchtime kickoff and a US night game on the right LA day", () => {
    const tz = "America/Los_Angeles";
    const uk = Date.parse("2026-10-24T11:30:00Z"); // 12:30 London (BST), 04:30 LA
    const us = Date.parse("2026-10-25T02:30:00Z"); // 19:30 LA on the 24th
    expect(dateKey(uk, tz)).toBe("2026-10-24");
    expect(dateKey(us, tz)).toBe("2026-10-24");
    expect(minutesIntoDay(uk, "2026-10-24", tz)).toBe(4 * 60 + 30);
    expect(minutesIntoDay(us, "2026-10-24", tz)).toBe(19 * 60 + 30);
  });

  it("handles the UK clock change a week before the US one", () => {
    // 25 Oct 2026: UK is back on GMT, LA still on PDT (8-hour gap)
    const ko = Date.parse("2026-10-25T14:00:00Z");
    expect(THEMES.broadcast.formatTime(ko, "Europe/London")).toBe("2:00P");
    expect(THEMES.broadcast.formatTime(ko, "America/Los_Angeles")).toBe("7:00A");
  });

  it("converts wall-clock time to UTC across zones", () => {
    expect(new Date(zonedToUtc(2026, 10, 24, 9, 0, "America/Los_Angeles")).toISOString()).toBe("2026-10-24T16:00:00.000Z");
    expect(new Date(zonedToUtc(2026, 10, 24, 9, 0, "Europe/London")).toISOString()).toBe("2026-10-24T08:00:00.000Z");
  });

  it("adds days across month ends", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("theme time formats", () => {
  const ms = Date.parse("2026-10-24T20:05:00Z");
  it("formats per theme", () => {
    expect(THEMES.broadcast.formatTime(ms, "America/Los_Angeles")).toBe("1:05P");
    expect(THEMES.editorial.formatTime(ms, "America/Los_Angeles")).toBe("1:05pm");
    expect(THEMES.terminal.formatTime(ms, "America/Los_Angeles")).toBe("13:05");
  });
  it("handles midnight and noon", () => {
    expect(THEMES.broadcast.formatTime(Date.parse("2026-10-24T07:00:00Z"), "America/Los_Angeles")).toBe("12:00A");
    expect(THEMES.editorial.formatTime(Date.parse("2026-10-24T19:00:00Z"), "America/Los_Angeles")).toBe("12:00pm");
  });
});
