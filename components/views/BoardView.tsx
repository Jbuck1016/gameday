"use client";

import "@fontsource/jetbrains-mono/700.css";
import "@fontsource/jetbrains-mono/800.css";
import { useMemo, useState } from "react";
import { dayParts } from "@/lib/time";
import { matchupLabel } from "@/lib/games";
import { boardStatus } from "@/lib/views";
import { PickButton } from "../GameRow";
import { TeamPair } from "./TeamDisc";
import { sides, teamLabel, watchLine, zoneLabel, type ViewProps } from "./shared";

const MONO = "'JetBrains Mono', ui-monospace, monospace";

/** Split-flap tiles: one character per tile with the flap's hinge line across the middle. */
function Flaps({ text, w, h, size }: { text: string; w: number; h: number; size: number }) {
  return (
    <span className="flex gap-[2px]" aria-hidden="true">
      {text.split("").map((ch, i) => (
        <span key={i} className="relative flex items-center justify-center rounded-[3px] bg-[#1b1c1f] font-extrabold" style={{ width: w, height: h, fontSize: size }}>
          {ch === " " ? "" : ch}
          <span className="absolute inset-x-0 h-px bg-black" style={{ top: Math.floor(h / 2) - 1 }} />
        </span>
      ))}
    </span>
  );
}

/** Board: every kickoff on a departures board. Finished games fold away; what's on and what's next stand out. */
export function BoardView({ games, tz, day, nowMs, isToday, myServices, priorityOf, onPriority, onOpen, formatTime, listTestId }: ViewProps) {
  const [showFinished, setShowFinished] = useState(false);
  const status = useMemo(() => boardStatus(games, nowMs), [games, nowMs]);
  const finished = games.filter((g) => status.get(g.id) === "final");
  // when every game is over (a past day), there is nothing to fold away
  const allDone = finished.length === games.length;
  const shown = showFinished || allDone ? games : games.filter((g) => status.get(g.id) !== "final");
  const { weekday, date } = dayParts(day);
  const zone = zoneLabel(tz, games[0] ? Date.parse(games[0].start) : nowMs);

  return (
    <section aria-label="Kickoffs board" className="-mx-4 mt-3 bg-[#0b0b0c] px-4 pt-5 pb-2 text-[#f1eadb] sm:mx-0 sm:rounded-2xl sm:px-7" style={{ fontFamily: MONO }}>
      <div className="flex items-end justify-between gap-3 pb-3">
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-bold tracking-[2px] text-[#ffb21a] sm:text-[13px]">
            KICKOFFS · {games.length} {games.length === 1 ? "GAME" : "GAMES"} · TIMES {zone}
          </span>
          <span className="sm:hidden">
            <Flaps text={`${weekday.slice(0, 3)} ${date}`.toUpperCase()} w={20} h={28} size={17} />
          </span>
          <span className="max-sm:hidden">
            <Flaps text={`${weekday.slice(0, 3)} ${date}`.toUpperCase()} w={34} h={48} size={30} />
          </span>
          <span className="sr-only">{`${weekday} ${date}`}</span>
        </div>
        {isToday ? (
          <span className="text-right text-[11px] font-bold leading-normal text-[#8c8f96] sm:text-[13px]">
            NOW
            <br />
            <span className="text-[15px] text-[#f1eadb] sm:text-[22px]">{formatTime(nowMs)}</span>
          </span>
        ) : null}
      </div>

      {finished.length > 0 && !allDone && (
        <button
          type="button"
          aria-expanded={showFinished}
          onClick={() => setShowFinished((v) => !v)}
          className="flex min-h-11 w-full items-center gap-2.5 border-t border-[#1f2024] text-left text-xs font-bold tracking-[1px] text-[#a3a6ad]"
        >
          <span>{finished.length} FINISHED</span>
          <span className="ml-auto text-[#f1eadb]">{showFinished ? "HIDE" : "SHOW"}</span>
        </button>
      )}

      <ul data-testid={listTestId}>
        {shown.map((g) => {
          const s = sides(g);
          const st = status.get(g.id);
          const w = watchLine(g, myServices);
          const p = priorityOf(g.id);
          const time = g.timeValid ? formatTime(Date.parse(g.start)) : "TBC";
          const [clock, mer] = time.split(" ");
          const game = `${teamLabel(s.first, s.firstRank, true)} ${s.sep.toUpperCase()} ${teamLabel(s.second, s.secondRank, true)}`.toUpperCase();
          const full = `${teamLabel(s.first, s.firstRank)} ${s.sep.toUpperCase()} ${teamLabel(s.second, s.secondRank)}`.toUpperCase();
          return (
            <li key={g.id} data-testid="game-row" data-event={g.id} className={`flex min-h-16 items-center gap-2.5 border-t border-[#1f2024] [content-visibility:auto] [contain-intrinsic-size:auto_64px] ${st === "final" ? "opacity-60" : ""}`}>
              <button
                type="button"
                aria-haspopup="dialog"
                aria-label={`${matchupLabel(g)}, ${time}, ${w.outlet}${st === "live" ? ", live now" : st === "final" ? ", finished" : ""}. Every way to watch`}
                onClick={() => onOpen(g)}
                className="flex min-w-0 flex-1 items-center gap-2 py-2 text-left sm:gap-4"
              >
                <span className="flex w-[64px] shrink-0 flex-col items-start gap-0.5 sm:w-auto sm:flex-row sm:items-baseline sm:gap-1.5">
                  <span className="sm:hidden">
                    <Flaps text={clock.padStart(5, " ")} w={12} h={20} size={13} />
                  </span>
                  <span className="max-sm:hidden">
                    <Flaps text={clock.padStart(5, " ")} w={16} h={26} size={17} />
                  </span>
                  <span className="text-[10px] font-bold text-[#8c8f96] sm:text-[11px]">{mer ?? ""}</span>
                </span>
                <span className="sm:hidden">
                  <TeamPair first={s.first} second={s.second} size={24} gap={3} />
                </span>
                <span className="max-sm:hidden">
                  <TeamPair first={s.first} second={s.second} size={40} gap={6} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-4">
                  <span className="truncate text-[13px] font-extrabold sm:hidden">{game}</span>
                  <span className="truncate text-[17px] font-extrabold max-sm:hidden sm:flex-1">{full}</span>
                  <span className="truncate text-[11px] font-medium text-[#a3a6ad] sm:w-56 sm:text-[15px] sm:font-bold sm:text-[#f1eadb]">
                    {w.outlet}
                    <span className="max-sm:hidden">
                      {w.free ? " · Free with antenna" : ""}
                      {g.involvesLocal ? " · Your team" : ""}
                    </span>
                  </span>
                </span>
              </button>
              <span className="flex shrink-0 justify-end sm:w-20">
                {st === "live" ? (
                  <span className="flex h-[22px] items-center gap-1.5 rounded bg-[#ffb21a] px-1.5 text-[11px] font-extrabold text-[#0b0b0c]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#0b0b0c]" />
                    LIVE
                  </span>
                ) : st === "next" && isToday ? (
                  <span className="flex h-[22px] items-center rounded border-[1.5px] border-[#f1eadb] px-1.5 text-[11px] font-extrabold">NEXT</span>
                ) : st === "final" ? (
                  <span className="text-[11px] font-bold text-[#a3a6ad]">FINAL</span>
                ) : null}
              </span>
              <PickButton game={g} priority={p} onChange={(np) => onPriority(g, np)} tone="board" />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
