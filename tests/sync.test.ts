import { describe, expect, it } from "vitest";
import { mergeFirstSignIn, prunePlan, samePrefs } from "@/lib/sync";
import type { AccountPrefs, PlanItem } from "@/lib/types";

const NOW = Date.parse("2026-10-24T20:00:00Z");
const item = (id: string, start: string, priority: "must" | "want" = "want"): PlanItem => ({
  eventId: `nba:${id}`,
  priority,
  start,
  leagueId: "nba",
  name: id,
});
const base = (over: Partial<AccountPrefs> = {}): AccountPrefs => ({
  area: null,
  localTeams: [],
  services: [],
  spanish: false,
  theme: "broadcast",
  tz: "America/Los_Angeles",
  plan: [],
  ...over,
});

describe("plan pruning", () => {
  it("drops games that ended more than two weeks ago and duplicates, keeps order by start", () => {
    const out = prunePlan(
      [item("b", "2026-10-25T02:00:00Z"), item("old", "2026-09-01T00:00:00Z"), item("a", "2026-10-24T18:00:00Z"), item("a", "2026-10-24T18:00:00Z")],
      NOW,
    );
    expect(out.map((i) => i.name)).toEqual(["a", "b"]);
  });
});

describe("first sign-in on a device", () => {
  it("keeps what the visitor picked before signing in and what the account already had", () => {
    const local = base({ plan: [item("x", "2026-10-25T01:00:00Z", "must")] });
    const account = base({ plan: [item("y", "2026-10-26T01:00:00Z")] });
    expect(mergeFirstSignIn(local, account, NOW).plan.map((i) => i.name)).toEqual(["x", "y"]);
  });

  it("lets the account's priority win on the same game", () => {
    const local = base({ plan: [item("x", "2026-10-25T01:00:00Z", "want")] });
    const account = base({ plan: [item("x", "2026-10-25T01:00:00Z", "must")] });
    expect(mergeFirstSignIn(local, account, NOW).plan).toEqual([item("x", "2026-10-25T01:00:00Z", "must")]);
  });

  it("uses the account's area and teams when set, the device's when the account has none", () => {
    const local = base({ area: { label: "Boston, MA", source: "zip", zip: "02108", confirmed: true }, localTeams: [{ id: "nba:2", name: "Celtics", leagueId: "nba" }], services: ["fubo"] });
    const empty = mergeFirstSignIn(local, base(), NOW);
    expect(empty.area?.label).toBe("Boston, MA");
    expect(empty.localTeams).toHaveLength(1);
    expect(empty.services).toEqual(["fubo"]);
    const set = mergeFirstSignIn(local, base({ area: { label: "Los Angeles, CA", source: "ip", zip: null, confirmed: true }, services: ["youtube_tv"] }), NOW);
    expect(set.area?.label).toBe("Los Angeles, CA");
    expect(set.services).toEqual(["youtube_tv"]);
  });

  it("compares settings by value", () => {
    expect(samePrefs(base(), base())).toBe(true);
    expect(samePrefs(base(), base({ spanish: true }))).toBe(false);
  });
});
