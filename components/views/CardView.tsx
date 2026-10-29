"use client";

import "@fontsource/anton/400.css";
import "@fontsource/barlow-condensed/600.css";
import "@fontsource/barlow-condensed/700.css";
import { dayParts } from "@/lib/time";
import { matchupLabel } from "@/lib/games";
import { PickButton } from "../GameRow";
import { TeamDisc } from "./TeamDisc";
import { inkOn, sides, teamFill, teamLabel, watchLine, zoneLabel, type ViewProps } from "./shared";

const DISPLAY = "Anton, Impact, sans-serif";
const LABEL = "'Barlow Condensed', 'Arial Narrow', sans-serif";

/** Card: the games as matchday-poster bands in both teams' colours, kickoff and channel on the seam. */
export function CardView({ games, tz, day, myServices, priorityOf, onPriority, onOpen, formatTime, reasons, listTestId }: ViewProps) {
  const { weekday, date } = dayParts(day);
  const zone = zoneLabel(tz, games[0] ? Date.parse(games[0].start) : Date.now());
  return (
    <section aria-label="The card" className="-mx-4 mt-3 bg-[#f2ede3] px-4 pt-5 pb-4 text-[#121212] sm:mx-0 sm:rounded-2xl sm:px-6">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div className="flex flex-col">
          <span style={{ fontFamily: LABEL }} className="text-[15px] font-bold tracking-[3px]">
            THE CARD · {games.length} {games.length === 1 ? "GAME" : "GAMES"}
          </span>
          <span style={{ fontFamily: DISPLAY }} className="text-[40px] leading-none whitespace-nowrap sm:text-[44px]">
            {weekday.slice(0, 3).toUpperCase()} <span className="text-[#c42a18]">{date.toUpperCase()}</span>
          </span>
        </div>
        <span style={{ fontFamily: LABEL }} className="text-right text-sm font-semibold">
          TIMES {zone}
          <br />
          RED = MUST WATCH
        </span>
      </div>
      <ul className="flex flex-col gap-3.5" data-testid={listTestId}>
        {games.map((g) => {
          const s = sides(g);
          const c1 = teamFill(s.first);
          const c2 = teamFill(s.second);
          const w = watchLine(g, myServices);
          const p = priorityOf(g.id);
          const time = g.timeValid ? formatTime(Date.parse(g.start)) : "TBC";
          // the band already shows ranks, so the caption skips "#5 in action" and "#7 v #19"
          const shownReasons = reasons?.get(g.id)?.filter((r) => !/^#\d+ (in action|v #\d+)$/.test(r));
          const why = shownReasons?.join(" · ") || [g.leagueShort, w.free ? "Free with antenna" : null, g.involvesLocal ? "Your team" : null].filter(Boolean).join(" · ");
          // a 375px phone leaves about 80px per name: seven poster characters at 20px, eight at 17px,
          // and longer names go to the abbreviation there
          const phoneName = (t: typeof s.first, r: number | null) => {
            const full = teamLabel(t, r);
            if (full.length > 8) return { text: teamLabel(t, r, true).toUpperCase(), size: "text-xl" };
            return { text: full.toUpperCase(), size: full.length > 7 ? "text-[17px]" : "text-xl" };
          };
          const n1 = phoneName(s.first, s.firstRank);
          const n2 = phoneName(s.second, s.secondRank);
          return (
            <li key={g.id} data-testid="game-row" data-event={g.id} className="flex flex-col shadow-[0_1px_0_rgba(18,18,18,0.08)] [content-visibility:auto] [contain-intrinsic-size:auto_144px]">
              <button
                type="button"
                aria-haspopup="dialog"
                aria-label={`${matchupLabel(g)}, ${time}, ${w.outlet}. Every way to watch`}
                onClick={() => onOpen(g)}
                className="relative flex h-[92px] items-center text-left sm:h-24"
                style={{ backgroundImage: `linear-gradient(100deg, ${c1} 0%, ${c1} 50%, ${c2} 50%, ${c2} 100%)` }}
              >
                <span className="flex w-1/2 min-w-0 items-center gap-2 pl-2.5 pr-12 sm:gap-3.5 sm:pl-3.5">
                  <TeamDisc team={s.first} size={40} className="sm:hidden" />
                  <TeamDisc team={s.first} size={56} className="max-sm:hidden" />
                  <span style={{ fontFamily: DISPLAY, color: inkOn(c1) }} className={`truncate ${n1.size} leading-tight sm:hidden`}>
                    {n1.text}
                  </span>
                  <span style={{ fontFamily: DISPLAY, color: inkOn(c1) }} className="truncate text-[28px] leading-tight max-sm:hidden">
                    {teamLabel(s.first, s.firstRank).toUpperCase()}
                  </span>
                </span>
                <span className="flex w-1/2 min-w-0 items-center justify-end gap-2 pr-2.5 pl-12 sm:gap-3.5 sm:pr-3.5">
                  <span style={{ fontFamily: DISPLAY, color: inkOn(c2) }} className={`truncate text-right ${n2.size} leading-tight sm:hidden`}>
                    {n2.text}
                  </span>
                  <span style={{ fontFamily: DISPLAY, color: inkOn(c2) }} className="truncate text-right text-[28px] leading-tight max-sm:hidden">
                    {teamLabel(s.second, s.secondRank).toUpperCase()}
                  </span>
                  <TeamDisc team={s.second} size={40} className="sm:hidden" />
                  <TeamDisc team={s.second} size={56} className="max-sm:hidden" />
                </span>
                <span className={`absolute top-1/2 left-1/2 flex w-[84px] -translate-x-1/2 -translate-y-1/2 flex-col items-center py-1.5 sm:w-32 ${p === "must" ? "bg-[#c42a18]" : "bg-[#121212]"}`}>
                  <span style={{ fontFamily: DISPLAY }} className="text-[19px] leading-tight text-white sm:text-2xl">
                    {time}
                  </span>
                  <span style={{ fontFamily: LABEL }} className={`max-w-full truncate px-1 text-[13px] font-bold sm:text-base ${p === "must" ? "text-[#fff3c4]" : "text-[#ffd23f]"}`}>
                    {w.outlet.toUpperCase()}
                  </span>
                </span>
              </button>
              <div className="flex min-h-[52px] items-center gap-2.5 bg-white pr-1.5 pl-3">
                <span style={{ fontFamily: LABEL }} className="min-w-0 flex-1 truncate text-[15px] font-bold tracking-[0.5px] uppercase">
                  {why}
                </span>
                <PickButton game={g} priority={p} onChange={(np) => onPriority(g, np)} tone="card" />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
