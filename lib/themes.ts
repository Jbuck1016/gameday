// Looks for the share card (the site itself has one look, Daylight, set in globals.css).
// Daylight is the default card look; the three older skins stay as export options.

import type { ThemeId } from "@/lib/types";
import { ensureContrast } from "@/lib/contrast";
import { zonedParts } from "@/lib/time";

export type Theme = {
  id: ThemeId;
  label: string;
  ground: string;
  surface: string;
  surface2: string;
  text: string;
  muted: string;
  accent: string;
  line: string;
  wantColor: string;
  fonts: { display: string; label: string; body: string };
  /** card font family names (must match the woff files registered in lib/og/fonts.ts) */
  cardFonts: { display: string; label: string; body: string };
  displayWeight: number;
  uppercaseLabels: boolean;
  formatTime: (ms: number, tz: string) => string;
};

function hm(ms: number, tz: string) {
  const p = zonedParts(ms, tz);
  const h12 = p.hour % 12 === 0 ? 12 : p.hour % 12;
  return { h24: p.hour, h12, m: String(p.minute).padStart(2, "0"), pm: p.hour >= 12 };
}

export const THEMES: Record<ThemeId, Theme> = {
  daylight: {
    id: "daylight",
    label: "Daylight",
    ground: "#FFFFFF",
    surface: "#F1F3F6",
    surface2: "#E6E8EC",
    text: "#111318",
    muted: "#5F6673",
    accent: "#111318",
    line: "#E6E8EC",
    wantColor: "#9AA1AD",
    fonts: {
      display: "'Inter', system-ui, sans-serif",
      label: "'Inter', system-ui, sans-serif",
      body: "'Inter', system-ui, sans-serif",
    },
    cardFonts: { display: "Inter", label: "Inter", body: "Inter" },
    displayWeight: 700,
    uppercaseLabels: false,
    formatTime: (ms, tz) => {
      const t = hm(ms, tz);
      return `${t.h12}:${t.m} ${t.pm ? "PM" : "AM"}`;
    },
  },
  broadcast: {
    id: "broadcast",
    label: "Broadcast",
    ground: "#0B1220",
    surface: "#131C2E",
    surface2: "#1B2740",
    text: "#F5F7FA",
    muted: "#9AA6B8",
    accent: "#F2C94C",
    line: "#1B2740",
    wantColor: "#9AA6B8",
    fonts: {
      display: "'Anton', 'Arial Narrow', sans-serif",
      label: "'Barlow Condensed', 'Arial Narrow', sans-serif",
      body: "'Barlow', system-ui, sans-serif",
    },
    cardFonts: { display: "Anton", label: "Barlow Condensed", body: "Barlow" },
    displayWeight: 400,
    uppercaseLabels: true,
    formatTime: (ms, tz) => {
      const t = hm(ms, tz);
      return `${t.h12}:${t.m}${t.pm ? "P" : "A"}`;
    },
  },
  editorial: {
    id: "editorial",
    label: "Editorial",
    ground: "#FFFFFF",
    surface: "#FFFFFF",
    surface2: "#F4F4F2",
    text: "#111111",
    muted: "#5A5A5A",
    accent: "#B3121F",
    line: "#E4E4E4",
    wantColor: "#111111",
    fonts: {
      display: "'Newsreader', Georgia, serif",
      label: "'Public Sans', system-ui, sans-serif",
      body: "'Public Sans', system-ui, sans-serif",
    },
    cardFonts: { display: "Newsreader", label: "Public Sans", body: "Public Sans" },
    displayWeight: 400,
    uppercaseLabels: false,
    formatTime: (ms, tz) => {
      const t = hm(ms, tz);
      return `${t.h12}:${t.m}${t.pm ? "pm" : "am"}`;
    },
  },
  terminal: {
    id: "terminal",
    label: "Terminal",
    ground: "#0A0A0A",
    surface: "#0A0A0A",
    surface2: "#141414",
    text: "#D9D9D9",
    muted: "#8C8C8C",
    accent: "#FFB000",
    line: "#2A2A2A",
    wantColor: "#6FB7FF",
    fonts: {
      display: "'JetBrains Mono', ui-monospace, monospace",
      label: "'JetBrains Mono', ui-monospace, monospace",
      body: "'JetBrains Mono', ui-monospace, monospace",
    },
    cardFonts: { display: "JetBrains Mono", label: "JetBrains Mono", body: "JetBrains Mono" },
    displayWeight: 800,
    uppercaseLabels: true,
    formatTime: (ms, tz) => {
      const t = hm(ms, tz);
      return `${String(t.h24).padStart(2, "0")}:${t.m}`;
    },
  },
};

export const THEME_IDS: ThemeId[] = ["daylight", "broadcast", "editorial", "terminal"];
export const SITE_THEME: ThemeId = "daylight";

export function isThemeId(x: unknown): x is ThemeId {
  return typeof x === "string" && (THEME_IDS as string[]).includes(x);
}

/** Visual for a timeline bar. Must = filled, want = outline (distinguishable without color). */
export function barStyle(theme: Theme, priority: "must" | "want", teamColor: string | null): {
  background: string;
  border: string;
  backgroundImage?: string;
} {
  const team = ensureContrast(teamColor, theme.surface, 3);
  if (theme.id === "daylight") {
    return priority === "must"
      ? { background: team, border: `2px solid ${team}` }
      : { background: "transparent", border: `2.5px solid ${team}` };
  }
  if (theme.id === "broadcast") {
    return priority === "must"
      ? { background: team, border: `2px solid ${team}` }
      : { background: "transparent", border: `3px solid ${team}` };
  }
  if (theme.id === "editorial") {
    return priority === "must"
      ? { background: theme.text, border: `1.5px solid ${theme.text}` }
      : {
          background: "transparent",
          border: `1.5px solid ${theme.text}`,
          backgroundImage: `repeating-linear-gradient(45deg, ${theme.text} 0px, ${theme.text} 1.5px, transparent 1.5px, transparent 6px)`,
        };
  }
  return priority === "must"
    ? { background: theme.accent, border: `1px solid ${theme.accent}` }
    : { background: "rgba(111,183,255,0.18)", border: `1px solid ${theme.wantColor}` };
}
