// The exported day card. Rendered by next/og (Satori): flexbox only, every element with more
// than one child sets display:flex, and all styles are inline.

import type { CSSProperties, ReactNode } from "react";
import { cardWhere, cardWindow, timelineLabel, type DayModel } from "@/lib/plan";
import { barStyle, type Theme } from "@/lib/themes";
import { ensureContrast } from "@/lib/contrast";
import { matchupLabel, teamColor } from "@/lib/games";
import { minutesIntoDay, parseDateKey } from "@/lib/time";
import { APP_NAME } from "@/lib/config";

export type CardSize = "portrait" | "story" | "square";
export const CARD_DIMENSIONS: Record<CardSize, { width: number; height: number; timelineRows: number; listRows: number; pad: number }> = {
  portrait: { width: 1080, height: 1350, timelineRows: 6, listRows: 5, pad: 56 },
  story: { width: 1080, height: 1920, timelineRows: 9, listRows: 9, pad: 64 },
  square: { width: 1080, height: 1080, timelineRows: 5, listRows: 3, pad: 44 },
};

const TRACK_W = 760;
const LABEL_W = 150;

function dateTitle(theme: Theme, key: string): string {
  const { y, m, d } = parseDateKey(key);
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-GB", { ...o, timeZone: "UTC" }).format(date);
  if (theme.id === "broadcast") return `${fmt({ weekday: "long" })} ${d} ${fmt({ month: "short" })}`.toUpperCase();
  if (theme.id === "terminal") return `${fmt({ weekday: "short" }).toUpperCase()} ${String(d).padStart(2, "0")}.${String(m).padStart(2, "0")}`;
  return `${fmt({ weekday: "long" })}, ${d} ${fmt({ month: "long" })}`;
}

function hourLabel(theme: Theme, h: number): string {
  const hh = h % 24;
  if (theme.id === "terminal") return String(hh).padStart(2, "0");
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  if (theme.id === "editorial") return hh === 12 ? "noon" : `${h12}${hh < 12 ? "am" : "pm"}`;
  return `${h12}${hh < 12 ? "A" : "P"}`;
}

/** "7:30 PM" -> "7:30" and "PM"; formats without a meridiem pass through whole. */
const clockPart = (t: string) => t.split(" ")[0];
const meridiemPart = (t: string) => t.split(" ")[1] ?? "";

const flexRow = (s: CSSProperties = {}): CSSProperties => ({ display: "flex", flexDirection: "row", ...s });
const flexCol = (s: CSSProperties = {}): CSSProperties => ({ display: "flex", flexDirection: "column", ...s });

function Label({ theme, children, style }: { theme: Theme; children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        display: "flex",
        fontFamily: theme.cardFonts.label,
        fontWeight: theme.id === "editorial" ? 600 : 700,
        letterSpacing: theme.uppercaseLabels ? 2 : 1,
        textTransform: theme.uppercaseLabels ? "uppercase" : "none",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function DayCard({
  theme,
  model,
  size,
  areaLabel,
  siteHost = null,
}: {
  theme: Theme;
  model: DayModel;
  size: CardSize;
  areaLabel: string | null;
  siteHost?: string | null;
}) {
  const dim = CARD_DIMENSIONS[size];
  const win = cardWindow(model);
  const span = win.end - win.start;
  const x = (ms: number) => Math.max(0, Math.min(TRACK_W, ((minutesIntoDay(ms, model.dayKey, model.tz) - win.start) / span) * TRACK_W));
  const step = span > 8 * 60 ? 120 : 60;
  const hours: number[] = [];
  for (let m = Math.ceil(win.start / step) * step; m < win.end; m += step) hours.push(m / 60);
  const tlGames = model.games.slice(0, dim.timelineRows);
  const listGames = model.games.slice(0, dim.listRows);
  const hidden = model.games.length - listGames.length;
  const musts = model.games.filter((g) => g.priority === "must").length;
  const wants = model.games.length - musts;
  const panel: CSSProperties =
    theme.id === "broadcast"
      ? { background: theme.surface, padding: "22px 26px" }
      : theme.id === "terminal"
        ? { border: `1px solid ${theme.line}`, padding: "18px 18px" }
        : { borderTop: `1px solid ${theme.text}`, borderBottom: `1px solid ${theme.text}`, padding: "18px 0" };
  const serviceNames = model.cover.chosen
    .map((id) => model.games.flatMap((g) => g.game.outlets.flatMap((o) => o.services)).find((s) => s.id === id)?.name ?? id)
    .slice(0, 6);

  return (
    <div
      style={flexCol({
        width: dim.width,
        height: dim.height,
        background: theme.ground,
        color: theme.text,
        padding: dim.pad,
        fontFamily: theme.cardFonts.body,
        gap: size === "square" ? 20 : 28,
      })}
    >
      {/* header */}
      <div style={flexCol({ gap: 16, ...(theme.id === "editorial" ? { borderBottom: `3px solid ${theme.text}`, paddingBottom: 18 } : {}) })}>
        <div style={flexCol({ gap: 6 })}>
          <Label theme={theme} style={{ fontSize: 22, color: theme.accent }}>
            {theme.id === "terminal" ? `> ${APP_NAME.toLowerCase().replace(" ", "_")} · ${areaLabel ?? "your area"}` : `${APP_NAME} · ${areaLabel ?? "your area"}`}
          </Label>
          <div
            style={{
              display: "flex",
              fontFamily: theme.cardFonts.display,
              fontWeight: theme.displayWeight,
              fontSize: size === "square" ? 64 : theme.id === "editorial" ? 70 : 84,
              lineHeight: 1,
              letterSpacing: theme.id === "terminal" ? -2 : theme.id === "editorial" ? -1 : 1,
              color: theme.id === "terminal" ? "#F2F2F2" : theme.text,
            }}
          >
            {dateTitle(theme, model.dayKey)}
          </div>
        </div>
        <div style={flexRow({ gap: 32 })}>
          <div style={flexRow({ alignItems: "center", gap: 10 })}>
            <div style={{ display: "flex", width: 28, height: 12, ...barStyle(theme, "must", theme.id === "broadcast" ? "#F5F7FA" : theme.id === "daylight" ? theme.text : null) }} />
            <Label theme={theme} style={{ fontSize: 20 }}>{`Must watch · ${musts}`}</Label>
          </div>
          <div style={flexRow({ alignItems: "center", gap: 10 })}>
            <div style={{ display: "flex", width: 28, height: 12, ...barStyle(theme, "want", theme.id === "broadcast" ? "#F5F7FA" : null) }} />
            <Label theme={theme} style={{ fontSize: 20 }}>{`Want to watch · ${wants}`}</Label>
          </div>
        </div>
      </div>

      {/* timeline */}
      <div style={flexCol({ gap: 10, ...panel })}>
        <div style={flexRow({})}>
          <div style={{ display: "flex", width: LABEL_W }} />
          <div style={{ display: "flex", position: "relative", width: TRACK_W, height: 22 }}>
            {hours.map((h) => (
              <div
                key={h}
                style={{
                  display: "flex",
                  position: "absolute",
                  left: Math.max(0, ((h * 60 - win.start) / span) * TRACK_W - 12),
                  fontSize: 17,
                  color: theme.muted,
                  fontFamily: theme.cardFonts.label,
                }}
              >
                {hourLabel(theme, h)}
              </div>
            ))}
          </div>
        </div>
        {tlGames.map((d) => {
          const left = x(d.start);
          const w = Math.max(10, x(d.end) - left);
          const label = timelineLabel(d.game);
          const color = teamColor(d.game, theme.surface);
          return (
            <div key={d.game.id} style={flexRow({ alignItems: "center", height: 38 })}>
              <div
                style={{
                  display: "flex",
                  width: LABEL_W,
                  fontSize: 19,
                  fontFamily: theme.cardFonts.label,
                  fontWeight: 700,
                  textTransform: theme.uppercaseLabels ? "uppercase" : "none",
                  overflow: "hidden",
                }}
              >
                {label.slice(0, 13)}
              </div>
              <div
                style={{
                  display: "flex",
                  position: "relative",
                  width: TRACK_W,
                  height: 38,
                  background: theme.id === "broadcast" ? "#0E1626" : "transparent",
                  borderBottom: theme.id === "editorial" ? `1px solid ${theme.line}` : "none",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    position: "absolute",
                    left,
                    top: theme.id === "editorial" ? 12 : 7,
                    width: w,
                    height: theme.id === "editorial" ? 14 : 24,
                    ...barStyle(theme, d.priority, color),
                  }}
                />
              </div>
            </div>
          );
        })}
        {model.overlaps.length > 0 && (
          <div style={flexRow({ gap: 24, paddingLeft: LABEL_W, flexWrap: "wrap" })}>
            {model.overlaps.slice(0, 3).map((o) => (
              <Label key={o.from} theme={theme} style={{ fontSize: 17, color: theme.accent }}>
                {`Overlap ${theme.formatTime(o.from, model.tz)}–${theme.formatTime(o.to, model.tz)} · ${o.ids.length} screens`}
              </Label>
            ))}
          </div>
        )}
      </div>

      {/* game list */}
      <div style={flexCol({ gap: 10 })}>
        {listGames.map((d) => {
          const team = ensureContrast(teamColor(d.game, theme.ground), theme.ground, 3);
          const timeBox: CSSProperties =
            theme.id === "broadcast"
              ? d.priority === "must"
                ? { background: team }
                : { border: `3px solid ${team}` }
              : theme.id === "terminal"
                ? {}
                : {};
          const { where, via } = cardWhere(d);
          const startLabel = theme.formatTime(d.start, model.tz);
          return (
            <div
              key={d.game.id}
              style={flexRow({
                height: 92,
                ...(theme.id === "editorial" ? { borderTop: `1px solid ${theme.line}` } : {}),
                ...(theme.id === "terminal" ? { borderBottom: `1px solid #1E1E1E` } : {}),
              })}
            >
              <div style={flexCol({ width: 170, flexShrink: 0, justifyContent: "center", paddingLeft: 18, ...timeBox })}>
                <div style={flexRow({ alignItems: "baseline", gap: 6, color: theme.id === "terminal" ? "#F2F2F2" : theme.text })}>
                  <div style={{ display: "flex", fontFamily: theme.cardFonts.display, fontWeight: theme.displayWeight, fontSize: 34 }}>
                    {d.game.timeValid ? clockPart(startLabel) : "TBC"}
                  </div>
                  {d.game.timeValid && meridiemPart(startLabel) ? (
                    <div style={{ display: "flex", fontFamily: theme.cardFonts.label, fontWeight: 700, fontSize: 18 }}>{meridiemPart(startLabel)}</div>
                  ) : null}
                </div>
                <Label theme={theme} style={{ fontSize: 16, color: theme.id === "broadcast" ? theme.text : theme.muted }}>
                  {`to ~${theme.formatTime(d.end, model.tz)}`}
                </Label>
              </div>
              <div
                style={flexCol({
                  flexGrow: 1,
                  flexShrink: 1,
                  minWidth: 0,
                  overflow: "hidden",
                  justifyContent: "center",
                  padding: "0 22px",
                  gap: 4,
                  background: theme.id === "broadcast" ? theme.surface : "transparent",
                })}
              >
                <div
                  style={{
                    display: "flex",
                    fontFamily: theme.cardFonts.display,
                    fontWeight: theme.id === "editorial" ? (d.priority === "must" ? 600 : 400) : theme.displayWeight,
                    fontStyle: theme.id === "editorial" && d.priority === "want" ? "italic" : "normal",
                    fontSize: theme.id === "terminal" ? 26 : matchupLabel(d.game).length > 26 ? 25 : 30,
                    textTransform: theme.id === "editorial" ? "none" : "uppercase",
                    color: theme.id === "terminal" ? "#F2F2F2" : theme.text,
                  }}
                >
                  {matchupLabel(d.game).slice(0, 34)}
                </div>
                <div style={{ display: "flex", fontSize: 17, color: theme.muted }}>
                  {[d.game.leagueName, d.game.venue].filter(Boolean).join(" · ").slice(0, 60)}
                </div>
              </div>
              <div
                style={flexCol({
                  width: 250,
                  flexShrink: 0,
                  justifyContent: "center",
                  alignItems: "flex-end",
                  paddingRight: 20,
                  gap: 3,
                  background: theme.id === "broadcast" ? theme.surface2 : "transparent",
                })}
              >
                <Label theme={theme} style={{ fontSize: where.length > 14 ? 19 : 24, color: theme.text, whiteSpace: "nowrap" }}>
                  {where.slice(0, 22)}
                </Label>
                {via && <div style={{ display: "flex", fontSize: 15, color: theme.muted, whiteSpace: "nowrap" }}>{via.slice(0, 28)}</div>}
              </div>
            </div>
          );
        })}
      </div>

      {/* footer */}
      <div
        style={flexRow({
          marginTop: "auto",
          justifyContent: "space-between",
          alignItems: "center",
          borderTop: `2px solid ${theme.id === "editorial" ? theme.text : theme.line}`,
          paddingTop: 20,
        })}
      >
        <div style={flexCol({ gap: 4 })}>
          <Label theme={theme} style={{ fontSize: 20, color: theme.accent }}>Services needed</Label>
          <div style={{ display: "flex", fontSize: 21 }}>{serviceNames.length ? serviceNames.join(" · ") : "None listed yet"}</div>
        </div>
        <div style={flexCol({ alignItems: "flex-end", gap: 4 })}>
          {hidden > 0 && <div style={{ display: "flex", fontSize: 17, color: theme.text }}>{`+${hidden} more in the plan`}</div>}
          <div style={{ display: "flex", fontSize: 15, color: theme.muted }}>End times estimated</div>
          {siteHost && <div style={{ display: "flex", fontSize: 18, color: theme.text }}>{`Make yours: ${siteHost}`}</div>}
        </div>
      </div>
    </div>
  );
}
