import { describe, expect, it } from "vitest";
import { contrastRatio, ensureContrast } from "@/lib/contrast";
import { THEMES, THEME_IDS } from "@/lib/themes";
import fixture from "@/fixtures/weekend-2026-10-24.json";

describe("theme contrast", () => {
  for (const id of THEME_IDS) {
    const t = THEMES[id];
    it(`${id}: body and muted text pass 4.5:1 on ground and surfaces`, () => {
      for (const bg of [t.ground, t.surface, t.surface2]) {
        expect(contrastRatio(t.text, bg)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(t.muted, bg)).toBeGreaterThanOrEqual(4.5);
      }
    });
    it(`${id}: accent passes 3:1 for large labels on ground`, () => {
      expect(contrastRatio(t.accent, t.ground)).toBeGreaterThanOrEqual(3);
    });
  }

  it("button text on the accent passes 4.5:1", () => {
    expect(contrastRatio("#0b1220", THEMES.broadcast.accent)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#ffffff", THEMES.editorial.accent)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#0a0a0a", THEMES.terminal.accent)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("ensureContrast on real team colours", () => {
  const colors = (fixture as { teams: { color: string | null }[] }).teams
    .map((t) => t.color)
    .filter((c): c is string => Boolean(c))
    .slice(0, 50);

  it("has 50 sample colours", () => {
    expect(colors.length).toBe(50);
  });

  for (const id of THEME_IDS) {
    it(`${id}: every adjusted team colour reaches 3:1 on the surface`, () => {
      for (const c of colors) {
        const out = ensureContrast(c, THEMES[id].surface, 3);
        expect(contrastRatio(out, THEMES[id].surface)).toBeGreaterThanOrEqual(3);
      }
    });
  }
});
