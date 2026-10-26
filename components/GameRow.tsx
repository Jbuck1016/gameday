"use client";

import { useState } from "react";
import type { Game, Priority } from "@/lib/types";
import { bestWatch, matchupLabel } from "@/lib/games";
import type { Theme } from "@/lib/themes";
import { WatchList } from "./WatchList";

export function TeamMark({ logo, abbr, size = 22 }: { logo: string | null | undefined; abbr: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const px = `${size}px`;
  return logo && !failed ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={logo} alt="" width={size} height={size} loading="lazy" onError={() => setFailed(true)} className="shrink-0 object-contain" style={{ width: px, height: px }} />
  ) : (
    <span aria-hidden className="inline-flex shrink-0 items-center justify-center rounded-full bg-surface2 text-[9px] font-semibold text-muted" style={{ width: px, height: px }}>
      {abbr.slice(0, 3)}
    </span>
  );
}

const NEXT: Record<string, Priority | null> = { none: "want", want: "must", must: null };

/** One round button: tap for Want, again for Must, again to remove. */
export function PickButton({ game, priority, onChange }: { game: Game; priority: Priority | null; onChange: (p: Priority | null) => void }) {
  const label = matchupLabel(game);
  const state = priority ?? "none";
  const aria = state === "none" ? `Add ${label} to plan` : state === "want" ? `${label}: want to watch. Tap for must watch` : `${label}: must watch. Tap to remove`;
  return (
    <button
      type="button"
      aria-label={aria}
      data-priority={state}
      onClick={() => onChange(NEXT[state])}
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-transform active:scale-95 ${
        state === "must" ? "bg-ink text-ground" : state === "want" ? "bg-want text-ink" : "btn-outline bg-surface text-ink"
      }`}
    >
      {state === "must" ? (
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2l2.9 6.6 7.1.7-5.3 4.8 1.6 7L12 17.5 5.7 21l1.6-7L2 9.3l7.1-.7z" />
        </svg>
      ) : state === "want" ? (
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M5 12l5 5L20 7" />
        </svg>
      ) : (
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25">
          <path d="M12 5v14M5 12h14" />
        </svg>
      )}
    </button>
  );
}

export function BestWatchLine({ game, myServices }: { game: Game; myServices: string[] }) {
  const best = bestWatch(game, myServices);
  if (!best) return <span className="text-xs text-muted">Channel TBA</span>;
  const free = best.serviceId === "antenna";
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-muted">
      <span className="font-semibold text-ink">{best.outlet}</span>
      {best.service && best.service !== best.outlet ? (
        <span className={`chip ${free ? "chip-good" : ""} ${best.mine ? "chip-mine" : ""} ${best.confidence === "likely" ? "dashed" : ""}`}>
          {free ? "Free with antenna" : best.service}
        </span>
      ) : null}
      {best.extra > 0 ? <span>+{best.extra}</span> : null}
      {best.confidence === "likely" ? <span>likely</span> : null}
      {best.confidence === "regional" ? <span>regional</span> : null}
    </span>
  );
}

export function Matchup({ game, size = "base" }: { game: Game; size?: "base" | "lg" }) {
  const homeFirst = game.sport === "soccer";
  const first = homeFirst ? game.home : game.away;
  const second = homeFirst ? game.away : game.home;
  const fr = homeFirst ? game.homeRank : game.awayRank;
  const sr = homeFirst ? game.awayRank : game.homeRank;
  const text = size === "lg" ? "text-lg" : "text-[15px]";
  if (!first && !second) return <span className={`font-semibold ${text}`}>{game.name}</span>;
  return (
    <span className={`flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 font-semibold ${text}`}>
      {first && (
        <span className="flex items-center gap-1.5">
          <TeamMark logo={first.logo} abbr={first.abbr} />
          {fr ? <span className="text-muted">#{fr}</span> : null}
          {first.short}
        </span>
      )}
      <span className="font-normal text-muted">{homeFirst ? "v" : "at"}</span>
      {second && (
        <span className="flex items-center gap-1.5">
          <TeamMark logo={second.logo} abbr={second.abbr} />
          {sr ? <span className="text-muted">#{sr}</span> : null}
          {second.short}
        </span>
      )}
    </span>
  );
}

export function GameRow({
  game,
  theme,
  tz,
  myServices,
  priority,
  onPriority,
  reasons,
}: {
  game: Game;
  theme: Theme;
  tz: string;
  myServices: string[];
  priority: Priority | null;
  onPriority: (p: Priority | null) => void;
  /** why it's featured, e.g. "#7 v #19" */
  reasons?: string[];
}) {
  const [open, setOpen] = useState(false);
  const start = Date.parse(game.start);
  const time = game.timeValid ? theme.formatTime(start, tz) : "TBC";
  const [clock, meridiem] = time.split(" ");
  return (
    <li className="border-b border-line" data-testid="game-row" data-event={game.id}>
      <div className="flex items-center gap-3 py-3">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          aria-expanded={open}
          aria-controls={`opts-${game.id}`}
          onClick={() => setOpen((o) => !o)}
        >
          <span className="w-13 shrink-0">
            <span className="block text-[15px] font-bold leading-tight">{clock}</span>
            <span className="block text-[11px] font-medium text-muted">
              {meridiem ? `${meridiem} · ` : ""}
              {game.leagueShort}
            </span>
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <Matchup game={game} />
              {game.involvesLocal ? <span className="chip chip-info">Your team</span> : null}
              {reasons?.map((r) => (
                <span key={r} className="chip">
                  {r}
                </span>
              ))}
            </span>
            <BestWatchLine game={game} myServices={myServices} />
          </span>
        </button>
        <PickButton game={game} priority={priority} onChange={onPriority} />
      </div>
      {open && (
        <div id={`opts-${game.id}`} className="panel mb-3 p-3">
          <WatchList game={game} myServices={myServices} />
          {game.venue && <p className="mt-3 text-xs text-muted">{game.venue}</p>}
        </div>
      )}
    </li>
  );
}
