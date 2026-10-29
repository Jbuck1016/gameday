"use client";

import { useMemo } from "react";
import type { Game } from "@/lib/types";
import { localDayRange, minutesIntoDay } from "@/lib/time";
import { matchupLabel } from "@/lib/games";
import { scoreGame } from "@/lib/featured";
import { assignLanes, clusterLanes, overlapBands, spanOf } from "@/lib/views";
import { PickButton } from "../GameRow";
import { TeamDisc, TeamPair } from "./TeamDisc";
import { gameFill, inkOn, sides, teamLabel, useMinWidth, watchLine, type ViewProps } from "./shared";

/** More than this and the timeline stops reading as a day; the Board lists everything. */
export const TIMELINE_MAX = 12;
/** The narrowest a phone block gets; busier stretches scroll sideways instead of shrinking further. */
const MIN_LANE = 96;

/** The biggest games for the timeline: planned ones first, then by Best's scoring. */
export function timelineGames(games: Game[], priorityOf: (id: string) => unknown): Game[] {
  if (games.length <= TIMELINE_MAX) return games;
  const score = (g: Game) => (priorityOf(g.id) ? 1000 : 0) + (scoreGame(g, 0)?.score ?? 0);
  return [...games].sort((a, b) => score(b) - score(a)).slice(0, TIMELINE_MAX);
}

/** The local clock hour at `ms`, read from the zone so clock-change days label correctly. */
export function hourLabel(ms: number, tz: string, short: boolean): string {
  const h = Number(new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hourCycle: "h23" }).format(new Date(ms))) % 24;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return short ? `${h12}${h < 12 ? "a" : "p"}` : `${h12} ${h < 12 ? "AM" : "PM"}`;
}

/** Timeline: the day as a schedule. Clashing games sit side by side; the margin marks how many at once. */
export function TimelineView(props: ViewProps & { allCount: number; onSeeAll: () => void }) {
  const { games, tz, day, nowMs, isToday, myServices, priorityOf, onPriority, onOpen, formatTime, listTestId, allCount, onSeeAll } = props;
  const wide = useMinWidth(768);
  // games without a confirmed kickoff can't go on the axis; they get their own list below it
  const timed = useMemo(() => games.filter((g) => g.timeValid), [games]);
  const tbc = useMemo(() => games.filter((g) => !g.timeValid), [games]);
  const layout = useMemo(() => {
    if (!timed.length) return null;
    const spans = timed.map((g) => spanOf(g, nowMs));
    const mins = (ms: number) => minutesIntoDay(ms, day, tz);
    const from = Math.floor(Math.min(...spans.map((s) => mins(s.start))) / 60) * 60;
    const to = Math.max(from + 240, Math.ceil(Math.max(...spans.map((s) => mins(s.end))) / 60) * 60);
    const { lane, lanes } = assignLanes(spans);
    const phone = clusterLanes(spans);
    const raw = overlapBands(spans);
    const bands = raw.map((b) => ({ from: mins(b.from), to: mins(b.to), n: b.n }));
    // the busiest stretch, earliest first on a tie
    const peak = raw.reduce<{ n: number; from: number } | null>((best, b) => (!best || b.n > best.n ? { n: b.n, from: b.from } : best), null);
    const byId = new Map(spans.map((s) => [s.id, { start: mins(s.start), end: mins(s.end) }]));
    return { from, to, lane, lanes, phone, bands, peak, byId, mins, dayStart: localDayRange(day, tz).from.getTime() };
  }, [timed, nowMs, day, tz]);

  if (!games.length) return null;
  const tbcList = tbc.length ? (
    <div className="mt-4">
      <h3 className="mb-1 text-sm font-extrabold">Time TBC</h3>
      <ul className="flex flex-col">
        {tbc.map((g) => {
          const w = watchLine(g, myServices);
          return (
            <li key={g.id} data-testid="game-row" data-event={g.id} className="flex items-center gap-2 border-t border-line">
              <button type="button" aria-haspopup="dialog" aria-label={`${matchupLabel(g)}, time TBC, ${w.outlet}. Every way to watch`} onClick={() => onOpen(g)} className="flex min-h-12 min-w-0 flex-1 items-center gap-2 text-left">
                <span className="truncate text-sm font-bold">{matchupLabel(g)}</span>
                <span className="shrink-0 text-xs text-muted">{w.outlet}</span>
              </button>
              <PickButton game={g} priority={priorityOf(g.id)} onChange={(np) => onPriority(g, np)} />
            </li>
          );
        })}
      </ul>
    </div>
  ) : null;
  if (!layout) return <section aria-label="Timeline" className="mt-3">{tbcList}</section>;
  const { from, to, lane, lanes, phone, bands, peak, byId, mins, dayStart } = layout;
  const ruleWidth = `max(100%, ${phone.maxLanes * MIN_LANE}px)`;
  const span = to - from;
  const hours: number[] = [];
  for (let m = Math.ceil(from / 60) * 60; m <= to; m += 60) hours.push(m);
  const nowMin = isToday ? mins(nowMs) : null;
  const showNow = nowMin !== null && nowMin > from && nowMin < to;
  const peakLabel = peak ? `${peak.n} at once from ${formatTime(peak.from)}` : null;
  const capped = allCount > games.length;

  return (
    <section aria-label="Timeline" className="mt-3">
      <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        {peakLabel ? <span className="text-sm font-extrabold text-[#c2410c]">{peakLabel}</span> : <span className="text-sm text-muted">No clashes</span>}
        {!wide && phone.maxLanes >= 4 ? <span className="text-xs text-muted">Busy stretches scroll sideways</span> : null}
        {capped ? (
          <span className="text-xs text-muted">
            The {games.length} biggest of {allCount}.{" "}
            <button type="button" className="link" onClick={onSeeAll}>
              See every game on the Board
            </button>
          </span>
        ) : null}
      </div>

      {!wide ? (
        // phone: time runs down the page, clashes sit side by side
        <div className="relative flex" style={{ height: span * 1.2 + 16 }}>
          <div className="relative w-10 shrink-0" aria-hidden="true">
            {hours.map((m) => (
              <span key={m} className="absolute left-0 text-[11px] font-semibold text-muted" style={{ top: (m - from) * 1.2 }}>
                {hourLabel(dayStart + m * 60000, tz, true)}
              </span>
            ))}
            {bands.map((b) => (
              <span key={b.from} className="absolute right-1.5 w-1 rounded-sm" style={{ top: (b.from - from) * 1.2 + 8, height: Math.max(4, (b.to - b.from) * 1.2 - 2), background: b.n >= 3 ? "#f2551d" : "#f8a77f" }} />
            ))}
          </div>
          <div className="relative min-w-0 flex-1 overflow-x-auto overflow-y-hidden overscroll-x-contain">
          <ul className="relative h-full" data-testid={listTestId}>
            {hours.map((m) => (
              <li key={m} aria-hidden="true" className="absolute left-0 h-px bg-[#eef0f3]" style={{ top: (m - from) * 1.2 + 8, width: ruleWidth }} />
            ))}
            {showNow ? <li aria-hidden="true" className="absolute left-0 z-10 h-0.5 bg-[#c2410c]" style={{ top: (nowMin! - from) * 1.2 + 8, width: ruleWidth }} /> : null}
            {timed.map((g) => {
              const t = byId.get(g.id)!;
              const s = sides(g);
              const fill = gameFill(g);
              const ink = inkOn(fill);
              const w = watchLine(g, myServices);
              const l = phone.lane.get(g.id) ?? 0;
              const k = phone.width.get(g.id) ?? 1;
              const laneW = `max(${MIN_LANE}px, ${100 / k}%)`;
              const time = g.timeValid ? formatTime(Date.parse(g.start)) : "TBC";
              return (
                <li
                  key={g.id}
                  data-testid="game-row"
                  data-event={g.id}
                  className="absolute box-border p-0.5"
                  style={{ top: (t.start - from) * 1.2 + 8, height: Math.max(56, (t.end - t.start) * 1.2), left: `calc(${l} * ${laneW})`, width: laneW }}
                >
                  <div className="relative flex h-full flex-col overflow-hidden rounded-xl" style={{ background: fill, color: ink }}>
                    <button type="button" aria-haspopup="dialog" aria-label={`${matchupLabel(g)}, ${time}, ${w.outlet}. Every way to watch`} onClick={() => onOpen(g)} className="flex h-full flex-col items-start gap-1.5 p-2 text-left">
                      {k >= 3 ? <TeamDisc team={s.first} size={26} /> : <TeamPair first={s.first} second={s.second} size={26} />}
                      <span className="text-[13px] font-extrabold leading-tight">
                        {teamLabel(s.first, s.firstRank, true)} {s.sep} {teamLabel(s.second, s.secondRank, true)}
                      </span>
                      <span className="text-[11px] font-semibold">{time}</span>
                      <span className="mt-auto max-w-full truncate rounded-full bg-white px-2 py-0.5 text-[11px] font-extrabold text-[#111318]">{w.outlet}</span>
                    </button>
                    <PickButton game={g} priority={priorityOf(g.id)} onChange={(np) => onPriority(g, np)} compact className="absolute top-0 right-0" />
                  </div>
                </li>
              );
            })}
          </ul>
          </div>
        </div>
      ) : (
        // laptop: time runs across, clashes stack in lanes
        <div className="relative" style={{ height: 36 + lanes * 104 }}>
          {hours.map((m) => (
            <span key={m} aria-hidden="true" className="absolute top-0 bottom-0 w-px bg-[#eef0f3]" style={{ left: `${((m - from) / span) * 100}%` }}>
              <span className="absolute top-0 left-1.5 text-[13px] font-semibold whitespace-nowrap text-muted">{hourLabel(dayStart + m * 60000, tz, false)}</span>
            </span>
          ))}
          {bands.map((b) => (
            <span key={b.from} aria-hidden="true" className="absolute top-7 h-1 rounded-sm" style={{ left: `${((b.from - from) / span) * 100}%`, width: `${((b.to - b.from) / span) * 100}%`, background: b.n >= 3 ? "#f2551d" : "#f8a77f" }} />
          ))}
          {showNow ? <span aria-hidden="true" className="absolute top-0 bottom-0 z-10 w-0.5 bg-[#c2410c]" style={{ left: `${((nowMin! - from) / span) * 100}%` }} /> : null}
          <ul data-testid={listTestId}>
            {timed.map((g) => {
              const t = byId.get(g.id)!;
              const s = sides(g);
              const fill = gameFill(g);
              const ink = inkOn(fill);
              const w = watchLine(g, myServices);
              const time = g.timeValid ? formatTime(Date.parse(g.start)) : "TBC";
              return (
                <li
                  key={g.id}
                  data-testid="game-row"
                  data-event={g.id}
                  className="absolute box-border pr-1"
                  style={{ top: 44 + (lane.get(g.id) ?? 0) * 104, height: 88, left: `${((t.start - from) / span) * 100}%`, width: `${((t.end - t.start) / span) * 100}%` }}
                >
                  <div className="flex h-full items-center gap-2.5 rounded-full pr-2.5 pl-1.5" style={{ background: fill, color: ink }}>
                    <button type="button" aria-haspopup="dialog" aria-label={`${matchupLabel(g)}, ${time}, ${w.outlet}. Every way to watch`} onClick={() => onOpen(g)} className="flex h-full min-w-0 flex-1 items-center gap-2.5 text-left">
                      <TeamPair first={s.first} second={s.second} size={60} gap={6} />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-[17px] font-extrabold">
                          {teamLabel(s.first, s.firstRank)} {s.sep} {teamLabel(s.second, s.secondRank)}
                        </span>
                        <span className="text-[13px] font-semibold">{time}</span>
                      </span>
                      <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[13px] font-extrabold text-[#111318]">{w.outlet}</span>
                    </button>
                    <PickButton game={g} priority={priorityOf(g.id)} onChange={(np) => onPriority(g, np)} />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {tbcList}
    </section>
  );
}
