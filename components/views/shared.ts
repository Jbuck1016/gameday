"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { Game, Priority, TeamLite } from "@/lib/types";
import { contrastRatio, normalizeHex } from "@/lib/contrast";
import { bestWatch } from "@/lib/games";

/** Display order: home first for soccer ("Chelsea v Man Utd"), away first otherwise ("Florida at Georgia"). */
export function sides(g: Game): { first: TeamLite | null; second: TeamLite | null; firstRank: number | null; secondRank: number | null; sep: "v" | "at" } {
  const soccer = g.sport === "soccer";
  return soccer
    ? { first: g.home, second: g.away, firstRank: g.homeRank, secondRank: g.awayRank, sep: "v" }
    : { first: g.away, second: g.home, firstRank: g.awayRank, secondRank: g.homeRank, sep: "at" };
}

export function teamLabel(t: TeamLite | null, rank: number | null, useAbbr = false): string {
  const name = t ? (useAbbr ? t.abbr : t.short) : "TBD";
  return `${rank ? `#${rank} ` : ""}${name}`;
}

/** A team's fill colour; near-white primaries (white kits) fall back to the alternate. */
export function teamFill(t: TeamLite | null): string {
  if (!t?.color) return "#5f6673";
  const c = `#${normalizeHex(t.color)}`;
  if (contrastRatio(c, "#ffffff") < 1.4 && t.altColor) return `#${normalizeHex(t.altColor)}`;
  return c;
}

/** The fill for a game: the home team's colour. */
export function gameFill(g: Game): string {
  return teamFill(g.home ?? g.away);
}

/** White or near-black text, whichever reads better on `bg`. */
export function inkOn(bg: string): string {
  return contrastRatio("#ffffff", bg) >= contrastRatio("#121212", bg) ? "#ffffff" : "#121212";
}

/** The channel line for a game: the most useful outlet, and whether an antenna gets it free. */
export function watchLine(g: Game, myServices: string[]): { outlet: string; free: boolean; likely: boolean } {
  const b = bestWatch(g, myServices);
  if (!b) return { outlet: "TBA", free: false, likely: false };
  const free = g.outlets.some((o) => o.outlet === b.outlet && o.services.some((s) => s.id === "antenna" && s.status === "included"));
  // regional listings can name several stations ("KCOP-13; KTTV FOX 11"): show the first
  const outlet = b.outlet.split(";")[0].trim();
  return { outlet: b.confidence === "likely" ? `${outlet}?` : outlet, free, likely: b.confidence === "likely" };
}

/** True when the screen is at least `px` wide. Read straight from the media query on the client, false on the server. */
export function useMinWidth(px: number): boolean {
  const q = `(min-width: ${px}px)`;
  const subscribe = useCallback(
    (on: () => void) => {
      const m = window.matchMedia(q);
      m.addEventListener("change", on);
      return () => m.removeEventListener("change", on);
    },
    [q],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(q).matches,
    () => false,
  );
}

/** "PT", "ET" and so on for US zones; otherwise whatever short name the zone has. */
export function zoneLabel(tz: string, atMs: number): string {
  const n = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" }).formatToParts(new Date(atMs)).find((p) => p.type === "timeZoneName")?.value ?? "";
  return /^[ECMP][SD]T$/.test(n) ? `${n[0]}T` : n;
}

export type ViewProps = {
  games: Game[];
  tz: string;
  day: string;
  nowMs: number;
  isToday: boolean;
  myServices: string[];
  priorityOf: (id: string) => Priority | null;
  onPriority: (g: Game, p: Priority | null) => void;
  onOpen: (g: Game) => void;
  formatTime: (ms: number) => string;
  /** why each game made Best, shown on the Card view */
  reasons?: Map<string, string[]>;
  listTestId?: string;
};
