// WCAG contrast helpers, and a nudge for team colors that would vanish on the theme's ground.

export function normalizeHex(hex: string | null | undefined, fallback = "888888"): string {
  const h = (hex ?? "").replace("#", "").trim();
  if (/^[0-9a-fA-F]{6}$/.test(h)) return h.toLowerCase();
  if (/^[0-9a-fA-F]{3}$/.test(h)) return h.split("").map((c) => c + c).join("").toLowerCase();
  return fallback;
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function luminance(hex: string): number {
  const h = normalizeHex(hex);
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

function mix(hex: string, target: "000000" | "ffffff", t: number): string {
  const h = normalizeHex(hex);
  const out = [0, 2, 4].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16);
    const tc = parseInt(target.slice(i, i + 2), 16);
    return Math.round(c + (tc - c) * t).toString(16).padStart(2, "0");
  });
  return out.join("");
}

/** Lighten or darken a team color until it reaches `min` contrast against the ground. Returns '#rrggbb'. */
export function ensureContrast(teamHex: string | null | undefined, groundHex: string, min = 3): string {
  const base = normalizeHex(teamHex);
  if (contrastRatio(base, groundHex) >= min) return `#${base}`;
  const target = luminance(groundHex) < 0.5 ? "ffffff" : "000000";
  for (let t = 0.05; t <= 1.0001; t += 0.05) {
    const c = mix(base, target, t);
    if (contrastRatio(c, groundHex) >= min) return `#${c}`;
  }
  return `#${target}`;
}
