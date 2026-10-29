// Look B, "The Grid": the day's timeline is the picture. Each game is a bar in its team's
// colour, stacked where games clash, on the site's white Daylight ground. One signal colour
// (orange) marks the busiest clash.

import { X_H, X_W, inkOn, type XData, type XRow } from "./data";
import { Logo, col, row, sideLabel } from "./kit";
import { minutesIntoDay } from "@/lib/time";

const INK = "#111318";
const MUTED = "#5F6673";
const LINE = "#E6E8EC";
const SIGNAL = "#F2551D";
const SIGNAL_BG = "#FFF0E8";
const FONT = "Inter";
const PAD = 64;
const TW = X_W - PAD * 2;

function Header({ d, title, sub, signal }: { d: XData; title: string; sub: string; signal?: string }) {
  return (
    <div style={row({ justifyContent: "space-between", alignItems: "flex-start" })}>
      <div style={col({ gap: 4 })}>
        <div style={{ display: "flex", fontFamily: FONT, fontWeight: 800, fontSize: 112, letterSpacing: -5, lineHeight: 1, color: INK }}>{title}</div>
        <div style={row({ gap: 14 })}>
          <div style={{ display: "flex", fontFamily: FONT, fontWeight: 600, fontSize: 32, color: MUTED }}>{sub}</div>
          {signal ? <div style={{ display: "flex", fontFamily: FONT, fontWeight: 800, fontSize: 32, color: SIGNAL }}>{signal}</div> : null}
        </div>
      </div>
      <div style={row({ alignItems: "center", gap: 10, paddingTop: 10 })}>
        <div style={{ display: "flex", width: 18, height: 18, borderRadius: 18, background: SIGNAL }} />
        <div style={{ display: "flex", fontFamily: FONT, fontWeight: 800, fontSize: 36, letterSpacing: -1, color: INK }}>Game Day</div>
      </div>
    </div>
  );
}

function Footer({ d, label, pills = true }: { d: XData; label: string; pills?: boolean }) {
  return (
    <div style={row({ marginTop: "auto", justifyContent: "space-between", alignItems: "center" })}>
      <div style={row({ gap: 12, alignItems: "center" })}>
        <div style={{ display: "flex", fontFamily: FONT, fontWeight: 700, fontSize: 26, color: MUTED, marginRight: 4 }}>{label}</div>
        {(pills ? d.services : []).map((s) => (
          <div key={s.id} style={{ display: "flex", fontFamily: FONT, fontWeight: 800, fontSize: 26, color: "#FFFFFF", background: INK, padding: "8px 18px", borderRadius: 40 }}>
            {s.free ? `${s.name} (free)` : s.name}
          </div>
        ))}
        {pills && d.free && !d.services.some((s) => s.free) ? (
          <div style={{ display: "flex", fontFamily: FONT, fontWeight: 700, fontSize: 24, color: MUTED, marginLeft: 6 }}>{`${d.free.games} free with an ${d.free.name.toLowerCase()}`}</div>
        ) : null}
      </div>
      <div style={{ display: "flex", fontFamily: FONT, fontWeight: 700, fontSize: 24, color: INK }}>{`Plan yours · ${d.host}`}</div>
    </div>
  );
}

type Placed = { r: XRow; lane: number; x: number; w: number; labelOutside: boolean; labelLeft: boolean };

/** Greedy lanes in pixel space, so a label that sits outside a short bar still gets room. */
function place(rows: XRow[], x: (ms: number) => number, minInside: number, outsideW: number): { placed: Placed[]; lanes: number } {
  const ends: number[] = [];
  const placed: Placed[] = [];
  for (const r of [...rows].sort((a, b) => a.start - b.start)) {
    const x0 = x(r.start);
    const w = Math.max(24, x(r.end) - x0);
    const labelOutside = w < minInside;
    // an outside label goes right of the bar, or left when it would run off the frame
    const labelLeft = labelOutside && x0 + w + outsideW > TW;
    const left = labelLeft ? x0 - outsideW : x0;
    const right = x0 + w + (labelOutside && !labelLeft ? outsideW : 0);
    let lane = ends.findIndex((e) => e <= left + 2);
    if (lane === -1) {
      lane = ends.length;
      ends.push(right);
    } else ends[lane] = right;
    placed.push({ r, lane, x: x0, w, labelOutside, labelLeft });
  }
  return { placed, lanes: ends.length };
}

/** Lanes grow to fill `height` (up to `maxLane` each); logo and type scale with the lane. */
function Timeline({ d, rows, from, to, height, maxLane, big }: { d: XData; rows: XRow[]; from: number; to: number; height: number; maxLane: number; big: boolean }) {
  // lanes can grow to fill the frame, but type stays sized for the bars' widths
  const sized = (laneH: number) => ({ laneH, logo: Math.min(big ? 92 : 72, Math.round(laneH * 0.68)), text: Math.min(big ? 38 : 28, Math.round(laneH * 0.3)) });
  const first = layout(d, rows, from, to, sized(maxLane), big);
  const fitted = first.lanes * maxLane <= height ? first : layout(d, rows, from, to, sized(Math.max(64, Math.floor(height / first.lanes))), big);
  return <TimelineView d={d} from={from} to={to} big={big} {...fitted} />;
}

type Sizes = { laneH: number; logo: number; text: number };

function layout(d: XData, rows: XRow[], from: number, to: number, z: Sizes, big: boolean) {
  const span = to - from;
  const x = (ms: number) => Math.max(0, Math.min(TW, ((minutesIntoDay(ms, d.dayKey, d.tz) - from) / span) * TW));
  const logosW = z.logo * 2 - Math.round(z.logo * 0.28) + 16;
  const { placed, lanes } = place(rows, x, logosW + z.text * 5 + 20, z.text * 6 + 20);
  return { ...z, placed, lanes };
}

function TimelineView({ d, from, to, laneH, logo, text, big, placed, lanes }: { d: XData; from: number; to: number; big: boolean; placed: Placed[]; lanes: number } & Sizes) {
  const span = to - from;
  const x = (ms: number) => Math.max(0, Math.min(TW, ((minutesIntoDay(ms, d.dayKey, d.tz) - from) / span) * TW));
  const full = (r: XRow) => `${sideLabel(r.first)} ${r.sep} ${sideLabel(r.second)}`;
  const short = (r: XRow) => `${r.first.abbr} ${r.sep} ${r.second.abbr}`;
  const textW = (t: string, size: number) => t.length * size * 0.64;
  const logosW = logo * 2 - Math.round(logo * 0.28) + 16;
  const chipW = (r: XRow) => textW(r.outlet, Math.round(text * 0.8)) + 30;
  // Inside a bar: logos first, then the channel chip, then the longest label that still fits.
  // Logos already say who's playing, so the label is the first thing to go.
  const label = (r: XRow, w: number): { t: string; size: number } | null => {
    const room = w - logosW - chipW(r) - 28;
    if (big && textW(full(r), text) <= room) return { t: full(r), size: text };
    if (textW(short(r), text) <= room) return { t: short(r), size: text };
    const small = Math.round(text * 0.78);
    return textW(short(r), small) <= room ? { t: short(r), size: small } : null;
  };
  const step = span > 9 * 60 ? 120 : 60;
  const hours: number[] = [];
  for (let m = Math.ceil(from / step) * step; m < to; m += step) hours.push(m);
  const hourLabel = (m: number) => {
    const h = Math.floor(m / 60) % 24;
    return `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? "a" : "p"}`;
  };
  const crunch = d.crunch;
  const band = crunch ? { x0: x(crunch.from), x1: x(crunch.to) } : null;
  const barH = laneH - 16;
  return (
    <div style={col({ position: "relative", width: TW })}>
      <div style={row({ position: "relative", height: 34 })}>
        {hours.map((m) => (
          <div key={m} style={{ display: "flex", position: "absolute", left: ((m - from) / span) * TW - 6, fontFamily: FONT, fontWeight: 600, fontSize: 22, color: MUTED }}>
            {hourLabel(m)}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", position: "relative", width: TW, height: lanes * laneH, borderTop: `2px solid ${LINE}` }}>
        {hours.map((m) => (
          <div key={m} style={{ display: "flex", position: "absolute", left: ((m - from) / span) * TW, top: 0, width: 2, height: lanes * laneH, background: LINE }} />
        ))}
        {band ? (
          <div style={{ display: "flex", position: "absolute", left: band.x0, top: 0, width: Math.max(4, band.x1 - band.x0), height: lanes * laneH, background: SIGNAL_BG, borderLeft: `3px solid ${SIGNAL}` }} />
        ) : null}
        {placed.map(({ r, lane, x: x0, w, labelOutside, labelLeft }) => {
          const fill = r.first.color;
          const ink = inkOn(fill);
          return (
            <div
              key={r.id}
              style={row({
                position: "absolute",
                top: lane * laneH + 8,
                height: barH,
                alignItems: "center",
                flexDirection: labelLeft ? "row-reverse" : "row",
                ...(labelLeft ? { right: TW - x0 - w } : { left: x0 }),
              })}
            >
              <div
                style={row({
                  width: w,
                  height: barH,
                  background: fill,
                  borderRadius: barH,
                  alignItems: "center",
                  paddingLeft: 4,
                  paddingRight: 14,
                  gap: 12,
                  overflow: "hidden",
                })}
              >
                <div style={row({ flexShrink: 0 })}>
                  <Logo side={r.first} size={logo} ring={3} />
                  <Logo side={r.second} size={logo} ring={3} style={{ marginLeft: -Math.round(logo * 0.28) }} />
                </div>
                {!labelOutside ? (
                  <div style={{ display: "flex", flexGrow: 1, fontFamily: FONT, fontWeight: 800, fontSize: label(r, w)?.size ?? text, color: ink, letterSpacing: -0.5, whiteSpace: "nowrap" }}>
                    {label(r, w)?.t ?? ""}
                  </div>
                ) : null}
                {!labelOutside ? (
                  <div style={{ display: "flex", flexShrink: 0, fontFamily: FONT, fontWeight: 800, fontSize: Math.round(text * 0.8), color: INK, background: "#FFFFFF", padding: "4px 12px", borderRadius: 30 }}>{r.outlet}</div>
                ) : null}
              </div>
              {labelOutside ? (
                <div style={col({ marginLeft: labelLeft ? 0 : 12, marginRight: labelLeft ? 12 : 0, alignItems: labelLeft ? "flex-end" : "flex-start" })}>
                  <div style={{ display: "flex", fontFamily: FONT, fontWeight: 800, fontSize: text, color: INK, whiteSpace: "nowrap" }}>{short(r)}</div>
                  <div style={{ display: "flex", fontFamily: FONT, fontWeight: 700, fontSize: Math.round(text * 0.72), color: MUTED }}>{`${r.time} · ${r.outlet}`}</div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const frame = { width: X_W, height: X_H, background: "#FFFFFF", padding: `52px ${PAD}px 44px`, gap: 22 } as const;

function fit(d: XData, rows: XRow[], padBefore = 0) {
  const starts = rows.map((r) => minutesIntoDay(r.start, d.dayKey, d.tz));
  const ends = rows.map((r) => minutesIntoDay(r.end, d.dayKey, d.tz));
  const from = Math.floor((Math.min(...starts) - padBefore) / 60) * 60;
  const to = Math.max(from + 240, Math.ceil(Math.max(...ends) / 60) * 60);
  return { from, to };
}

export function GridSlate({ d }: { d: XData }) {
  const rows = d.rows;
  const { from, to } = fit(d, rows);
  return (
    <div style={col(frame)}>
      <Header
        d={d}
        title={d.weekday}
        sub={`${d.date} · ${rows.length} games · times ${d.tzLabel}`}
        signal={d.crunch ? `${d.crunch.rows.length} at once from ${d.crunch.fromLabel}` : undefined}
      />
      <div style={{ display: "flex", marginTop: 22 }}>
        <Timeline d={d} rows={rows} from={from} to={to} height={500} maxLane={124} big={false} />
      </div>
      <Footer d={d} label="You need" />
    </div>
  );
}

export function GridCrunch({ d }: { d: XData }) {
  const c = d.crunch;
  if (!c) return <GridSlate d={d} />;
  const rows = c.rows.slice(0, 5);
  const { from, to } = fit(d, rows, 30);
  return (
    <div style={col(frame)}>
      <Header d={d} title={`${rows.length} at once`} sub={`${d.weekday} · ${c.fromLabel} to ${c.toLabel} ${d.tzLabel}`} />
      <div style={{ display: "flex", marginTop: 26 }}>
        <Timeline d={d} rows={rows} from={from} to={to} height={520} maxLane={128} big />
      </div>
      <Footer d={d} label="Covered by" />
    </div>
  );
}

export function GridCover({ d }: { d: XData }) {
  const total = d.rows.length;
  const byId = new Map(d.rows.map((r) => [r.id, r]));
  const paid = d.services.filter((s) => !s.free);
  const lines = [...d.services, ...(d.free && !d.services.some((s) => s.free) ? [d.free] : [])];
  return (
    <div style={col(frame)}>
      <Header
        d={d}
        title={`${paid.length} ${paid.length === 1 ? "subscription" : "subscriptions"}`}
        sub={`cover all ${total} of ${d.weekday}'s games · ${d.date}`}
        signal={d.free ? `${d.free.games} free with an ${d.free.name.toLowerCase()}` : undefined}
      />
      <div style={col({ gap: 30, marginTop: 30 })}>
        {lines.map((s) => (
          <div key={s.id} style={col({ gap: 12 })}>
            <div style={row({ alignItems: "baseline", gap: 18 })}>
              <div style={{ display: "flex", fontFamily: FONT, fontWeight: 800, fontSize: 52, letterSpacing: -1.5, color: INK }}>{s.name}</div>
              <div style={{ display: "flex", fontFamily: FONT, fontWeight: 700, fontSize: 28, color: s.free ? SIGNAL : MUTED }}>
                {`${s.games} of ${total} games${s.free ? " · free" : ""}`}
              </div>
            </div>
            <div style={row({ gap: 18, flexWrap: "wrap" })}>
              {s.gameIds.map((id) => byId.get(id)).filter((r): r is XRow => Boolean(r)).map((r) => (
                <div key={r.id} style={row({})}>
                  <Logo side={r.first} size={64} ring={3} ringColor="#F1F3F6" />
                  <Logo side={r.second} size={64} ring={3} ringColor="#F1F3F6" style={{ marginLeft: -16 }} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <Footer d={d} label="Channels and blackouts change with where you live" pills={false} />
    </div>
  );
}
