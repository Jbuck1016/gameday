"use client";

import { useState } from "react";
import type { Game, Priority } from "@/lib/types";
import { bestWatch, matchupLabel } from "@/lib/games";
import type { Theme } from "@/lib/themes";
import { WatchList } from "./WatchList";

export function TeamMark({ logo, abbr }: { logo: string | null | undefined; abbr: string }) {
  const [failed, setFailed] = useState(false);
  return logo && !failed ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={logo} alt="" width={22} height={22} loading="lazy" onError={() => setFailed(true)} className="h-5.5 w-5.5 shrink-0 object-contain" />
  ) : (
    <span aria-hidden className="inline-flex h-5.5 w-5.5 shrink-0 items-center justify-center bg-surface2 text-[9px] text-muted">
      {abbr.slice(0, 3)}
    </span>
  );
}

export function PriorityButtons({
  game,
  priority,
  onChange,
}: {
  game: Game;
  priority: Priority | null;
  onChange: (p: Priority | null) => void;
}) {
  const label = matchupLabel(game);
  return (
    <div className="flex gap-1.5" role="group" aria-label={`Add ${label} to your plan`}>
      <button
        type="button"
        className="btn px-3"
        aria-pressed={priority === "must"}
        onClick={() => onChange(priority === "must" ? null : "must")}
        aria-label={`Must watch: ${label}`}
      >
        Must
      </button>
      <button
        type="button"
        className="btn px-3"
        aria-pressed={priority === "want"}
        onClick={() => onChange(priority === "want" ? null : "want")}
        aria-label={`Want to watch: ${label}`}
      >
        Want
      </button>
    </div>
  );
}

export function BestWatchLine({ game, myServices }: { game: Game; myServices: string[] }) {
  const best = bestWatch(game, myServices);
  if (!best) return <span className="text-sm text-muted">Channel TBA</span>;
  return (
    <span className="flex flex-wrap items-center gap-1.5 text-sm">
      <span className="label text-ink">{best.outlet}</span>
      {best.service && best.service !== best.outlet && (
        <span className={`chip ${best.mine ? "chip-mine" : ""} ${best.confidence === "likely" ? "dashed" : ""}`}>{best.service}</span>
      )}
      {best.extra > 0 && <span className="text-xs text-muted">+{best.extra} more</span>}
      {best.confidence === "likely" && <span className="text-xs text-muted">likely, not announced</span>}
      {best.confidence === "regional" && <span className="text-xs text-muted">regional</span>}
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
}: {
  game: Game;
  theme: Theme;
  tz: string;
  myServices: string[];
  priority: Priority | null;
  onPriority: (p: Priority | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const start = Date.parse(game.start);
  const homeFirst = game.sport === "soccer";
  const first = homeFirst ? game.home : game.away;
  const second = homeFirst ? game.away : game.home;
  const firstRank = homeFirst ? game.homeRank : game.awayRank;
  const secondRank = homeFirst ? game.awayRank : game.homeRank;
  return (
    <li className="border-b border-line py-3" data-testid="game-row" data-event={game.id}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="w-16 shrink-0">
          <div className="display text-lg">{game.timeValid ? theme.formatTime(start, tz) : "TBC"}</div>
          <div className="label text-xs text-muted">{game.leagueShort}</div>
        </div>
        <div className="min-w-0 flex-1 basis-56">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {first && (
              <span className="flex items-center gap-1.5">
                <TeamMark logo={first.logo} abbr={first.abbr} />
                <span className="font-semibold">
                  {firstRank ? <span className="text-muted">#{firstRank} </span> : null}
                  {first.short}
                </span>
              </span>
            )}
            <span className="text-muted">{homeFirst ? "v" : "at"}</span>
            {second && (
              <span className="flex items-center gap-1.5">
                <TeamMark logo={second.logo} abbr={second.abbr} />
                <span className="font-semibold">
                  {secondRank ? <span className="text-muted">#{secondRank} </span> : null}
                  {second.short}
                </span>
              </span>
            )}
            {!first && !second && <span className="font-semibold">{game.name}</span>}
            {game.involvesLocal && <span className="chip text-xs">Local team</span>}
          </div>
          <div className="mt-1">
            <BestWatchLine game={game} myServices={myServices} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <PriorityButtons game={game} priority={priority} onChange={onPriority} />
          <button
            type="button"
            className="btn px-3"
            aria-expanded={open}
            aria-controls={`opts-${game.id}`}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? "Hide" : "Where"}
          </button>
        </div>
      </div>
      {open && (
        <div id={`opts-${game.id}`} className="mt-3 bg-surface2 p-3">
          <WatchList game={game} myServices={myServices} />
          {game.venue && <p className="mt-3 text-xs text-muted">{game.venue}</p>}
        </div>
      )}
    </li>
  );
}
