"use client";

import { timelineLabel, type DayModel } from "@/lib/plan";
import { barStyle, type Theme } from "@/lib/themes";
import { teamColor } from "@/lib/games";
import { minutesIntoDay } from "@/lib/time";

function hourLabel(theme: Theme, h: number): string {
  const hh = h % 24;
  if (theme.id === "terminal") return String(hh).padStart(2, "0");
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  if (theme.id === "editorial") return hh === 12 ? "noon" : `${h12}${hh < 12 ? "am" : "pm"}`;
  return `${h12}${hh < 12 ? "A" : "P"}`;
}

export function Timeline({ model, theme, compact = false }: { model: DayModel; theme: Theme; compact?: boolean }) {
  const span = model.windowEnd - model.windowStart;
  const pct = (ms: number) =>
    Math.max(0, Math.min(100, ((minutesIntoDay(ms, model.dayKey, model.tz) - model.windowStart) / span) * 100));
  const hours: number[] = [];
  const step = compact ? 240 : 120;
  for (let m = Math.ceil(model.windowStart / step) * step; m < model.windowEnd; m += step) hours.push(m / 60);
  const now = Date.now();
  const nowPct = pct(now);
  const showNow = now >= model.games[0]?.start - 6 * 3_600_000 && nowPct > 0 && nowPct < 100;

  if (!model.games.length) return null;
  return (
    <figure className={`panel ${compact ? "p-2" : "p-4"}`} aria-label="Timeline of the day's games">
      <div className="flex">
        <div className={compact ? "w-16 shrink-0" : "w-24 shrink-0 sm:w-32"} />
        <div className="relative h-5 flex-1 text-xs text-muted">
          {hours.map((h) => (
            <span key={h} className="label absolute -translate-x-1/2" style={{ left: `${((h * 60 - model.windowStart) / span) * 100}%` }}>
              {hourLabel(theme, h)}
            </span>
          ))}
        </div>
      </div>
      <ul className="space-y-1.5">
        {model.games.map((d) => {
          const left = pct(d.start);
          const width = Math.max(1.5, pct(d.end) - left);
          const label = timelineLabel(d.game);
          const bs = barStyle(theme, d.priority, teamColor(d.game, theme.surface));
          return (
            <li key={d.game.id} className="flex items-center">
              <span className={`label truncate pr-2 text-sm ${compact ? "w-16 shrink-0 text-xs" : "w-24 shrink-0 sm:w-32"}`} title={d.game.name}>
                {label}
              </span>
              <span className={`relative flex-1 ${compact ? "h-4" : "h-7"} ${theme.id === "broadcast" ? "bg-[#0E1626]" : ""}`}>
                {hours.map((h) => (
                  <span
                    key={h}
                    aria-hidden
                    className="absolute top-0 h-full w-px bg-line"
                    style={{ left: `${((h * 60 - model.windowStart) / span) * 100}%` }}
                  />
                ))}
                <span
                  className="absolute top-1/2 -translate-y-1/2"
                  style={{
                    left: `${left}%`,
                    width: `${width}%`,
                    height: compact ? "70%" : theme.id === "editorial" ? "50%" : "75%",
                    background: bs.background,
                    border: bs.border,
                    backgroundImage: bs.backgroundImage,
                    boxSizing: "border-box",
                  }}
                  title={`${theme.formatTime(d.start, model.tz)} to about ${theme.formatTime(d.end, model.tz)}${d.runningLong ? " (running long)" : ""}`}
                />
                <span className="sr-only">
                  {d.priority === "must" ? "Must watch" : "Want to watch"}, {theme.formatTime(d.start, model.tz)} to about{" "}
                  {theme.formatTime(d.end, model.tz)}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
      {showNow && !compact && (
        <p className="mt-2 text-right text-xs text-muted">Now: {theme.formatTime(now, model.tz)}</p>
      )}
      {!compact && model.overlaps.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-1 pl-24 sm:pl-32">
          {model.overlaps.map((o) => (
            <li key={o.from} className="label text-sm text-accent">
              Overlap {theme.formatTime(o.from, model.tz)}–{theme.formatTime(o.to, model.tz)} · {o.ids.length} screens
            </li>
          ))}
        </ul>
      )}
    </figure>
  );
}
