import { describe, expect, it } from "vitest";
import fixture from "@/fixtures/weekend-2026-10-24.json";
import { bestWatch, buildGames, matchupLabel, watchableServices } from "@/lib/games";
import { buildDayModel, cardWhere } from "@/lib/plan";
import type { EventRow, League, OptionRow, Team } from "@/lib/types";

const F = fixture as unknown as { events: EventRow[]; teams: Team[]; leagues: League[]; options: OptionRow[] };
const games = buildGames(F.events, F.teams, F.leagues, F.options);
const byName = (re: RegExp) => games.find((g) => re.test(g.name))!;

describe("building games from real rows", () => {
  it("keeps every event, including ones with no listing yet", () => {
    expect(games.length).toBe(F.events.length);
  });

  it("groups services under each channel", () => {
    const g = byName(/Indiana Hoosiers at Michigan/);
    const fox = g.outlets.find((o) => o.outlet === "FOX")!;
    expect(fox.services.map((s) => s.id)).toEqual(expect.arrayContaining(["youtube_tv", "fubo", "hulu_live", "antenna"]));
  });

  it("labels soccer home-first and US sports away-at-home", () => {
    expect(matchupLabel(byName(/Everton at Arsenal/))).toBe("Arsenal v Everton");
    expect(matchupLabel(byName(/Indiana Hoosiers at Michigan/))).toMatch(/Indiana at Michigan/);
  });
});

describe("best way to watch", () => {
  it("prefers a service the visitor has", () => {
    const g = byName(/Indiana Hoosiers at Michigan/);
    expect(bestWatch(g, ["hulu_live"])?.serviceId).toBe("hulu_live");
    expect(bestWatch(g, ["fubo"])?.serviceId).toBe("fubo");
  });

  it("keeps likely channels marked as likely", () => {
    const g = byName(/Everton at Arsenal/);
    expect(bestWatch(g, [])?.confidence).toBe("likely");
  });

  it("never offers a blacked-out option", () => {
    for (const g of games) {
      const b = bestWatch(g, []);
      if (b) expect(b.confidence).not.toBe("blacked_out");
    }
  });

  it("excludes add-on and unavailable services from coverage", () => {
    const g = byName(/Anaheim Ducks at Philadelphia/);
    expect(watchableServices(g)).not.toContain("hulu_live_x");
    const nhlNet = g.outlets.find((o) => o.outlet === "NHL Network");
    if (nhlNet) {
      const notOn = nhlNet.services.filter((s) => s.status === "not_available").map((s) => s.id);
      // NHL Network isn't on YouTube TV; the local KCOP/KTTV feed is, so YouTube TV is still watchable
      expect(notOn).toContain("youtube_tv");
    }
  });
});

describe("day card helpers", () => {
  it("shows likely channels together and marked", () => {
    const g = byName(/Everton at Arsenal/);
    const model = buildDayModel(games, new Map([[g.id, "must"]]), "2026-10-24", "America/Los_Angeles", []);
    const w = cardWhere(model.games[0]);
    expect(w.via).toMatch(/Likely/);
    expect(w.where).toMatch(/Peacock|NBC|USA/);
  });
});
