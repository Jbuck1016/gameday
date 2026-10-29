// Look A, "Departures": the day as a split-flap board. Kickoff is departure time, the channel
// is the gate, and the status column says CLASH. Mono caps in flap tiles on a black board.

import { X_H, X_W, pickRows, type XData, type XRow } from "./data";
import { Logo, col, row, sideLabel } from "./kit";

const BOARD = "#0B0B0C";
const TILE = "#1B1C1F";
const CREAM = "#F1EADB";
const AMBER = "#FFB21A";
const MUTED = "#8C8F96";
const MONO = "JetBrains Mono";

function Flaps({ text, size, n, color = CREAM, tile = TILE }: { text: string; size: number; n?: number; color?: string; tile?: string }) {
  const chars = (n ? text.toUpperCase().slice(0, n).padEnd(n, " ") : text.toUpperCase()).split("");
  const w = Math.round(size * 0.72);
  const h = Math.round(size * 1.3);
  return (
    <div style={row({ gap: Math.max(2, Math.round(size * 0.08)) })}>
      {chars.map((c, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            position: "relative",
            width: w,
            height: h,
            background: tile,
            borderRadius: Math.round(size * 0.1),
            alignItems: "center",
            justifyContent: "center",
            fontFamily: MONO,
            fontWeight: 800,
            fontSize: size,
            color,
          }}
        >
          {c === " " ? "" : c}
          <div style={{ display: "flex", position: "absolute", left: 0, right: 0, top: Math.round(h / 2) - 1, height: 2, background: "#000000" }} />
        </div>
      ))}
    </div>
  );
}

function gameText(r: XRow, n: number): string {
  const full = `${sideLabel(r.first)} ${r.sep} ${sideLabel(r.second)}`;
  return full.length <= n ? full : `${sideLabel(r.first, true)} ${r.sep} ${sideLabel(r.second, true)}`;
}

function Head({ d, title, label, size = 62 }: { d: XData; title: string; label: string; size?: number }) {
  return (
    <div style={row({ justifyContent: "space-between", alignItems: "flex-end" })}>
      <div style={col({ gap: 14 })}>
        <div style={{ display: "flex", fontFamily: MONO, fontWeight: 700, fontSize: 26, color: AMBER, letterSpacing: 4 }}>{label}</div>
        <Flaps text={title} size={size} />
      </div>
      <div style={col({ alignItems: "flex-end", gap: 6 })}>
        <div style={{ display: "flex", fontFamily: "Inter", fontWeight: 800, fontSize: 40, color: CREAM, letterSpacing: -1 }}>Game Day</div>
        <div style={{ display: "flex", fontFamily: MONO, fontWeight: 700, fontSize: 22, color: MUTED }}>{(d.area && /times/i.test(d.area) ? d.area : `TIMES ${d.tzLabel} · ${d.area ?? "NATIONAL TV"}`).toUpperCase().slice(0, 44)}</div>
      </div>
    </div>
  );
}

const COLS = { time: 5, mer: 2, game: 22, on: 11, status: 5 };
const logoSize = (size: number) => Math.round(size * 1.4);
const logoCol = (size: number) => logoSize(size) * 2 + 6;

function ColHeads({ size }: { size: number }) {
  const w = (n: number) => n * (Math.round(size * 0.72) + Math.max(2, Math.round(size * 0.08)));
  const s = { display: "flex", fontFamily: MONO, fontWeight: 700, fontSize: 20, color: MUTED, letterSpacing: 3 } as const;
  return (
    <div style={row({ gap: 18, paddingBottom: 6, borderBottom: `2px solid #26282D` })}>
      <div style={{ ...s, width: w(COLS.time + COLS.mer) + 18 }}>KICKOFF</div>
      <div style={{ ...s, width: logoCol(size) }} />
      <div style={{ ...s, width: w(COLS.game) }}>GAME</div>
      <div style={{ ...s, width: w(COLS.on) }}>ON</div>
      <div style={{ ...s }}>STATUS</div>
    </div>
  );
}

function BoardRow({ r, size }: { r: XRow; size: number }) {
  // on a busy day nearly everything clashes, so the column only flags must-watch games
  const status = r.priority === "must" ? "MUST" : "";
  return (
    <div style={row({ gap: 18, alignItems: "center" })}>
      <Flaps text={r.time.padStart(5, " ")} size={size} n={COLS.time} />
      <Flaps text={r.mer} size={size} n={COLS.mer} color={MUTED} />
      <div style={row({ width: logoCol(size) })}>
        <Logo side={r.first} size={logoSize(size)} />
        <Logo side={r.second} size={logoSize(size)} style={{ marginLeft: 6 }} />
      </div>
      <Flaps text={gameText(r, COLS.game)} size={size} n={COLS.game} />
      <Flaps text={r.outlet} size={size} n={COLS.on} color={CREAM} />
      <Flaps text={status} size={size} n={COLS.status} color={AMBER} />
    </div>
  );
}

function Foot({ d, left }: { d: XData; left: string }) {
  return (
    <div style={row({ marginTop: "auto", justifyContent: "space-between", alignItems: "center" })}>
      <div style={row({ gap: 16, alignItems: "center" })}>
        <div style={{ display: "flex", fontFamily: MONO, fontWeight: 700, fontSize: 22, color: AMBER, letterSpacing: 3 }}>{left}</div>
        <div style={{ display: "flex", fontFamily: MONO, fontWeight: 700, fontSize: 26, color: CREAM }}>
          {d.services.map((s) => s.name.toUpperCase()).join(" + ")}
        </div>
        {d.free && !d.services.some((s) => s.free) ? (
          <div style={{ display: "flex", fontFamily: MONO, fontWeight: 700, fontSize: 22, color: MUTED }}>{`· ${d.free.games} FREE WITH ${d.free.name.toUpperCase()}`}</div>
        ) : null}
      </div>
      <div style={{ display: "flex", fontFamily: MONO, fontWeight: 700, fontSize: 22, color: MUTED }}>{`PLAN YOURS · ${d.host.toUpperCase()}`}</div>
    </div>
  );
}

const frame = { width: X_W, height: X_H, background: BOARD, padding: "52px 64px 44px", gap: 26 } as const;

export function DeparturesSlate({ d }: { d: XData }) {
  const rows = pickRows(d.rows, 11);
  // a full Saturday gets smaller flaps so every kickoff fits on one board
  const size = rows.length > 7 ? 29 : 34;
  const more = d.rows.length - rows.length;
  return (
    <div style={col(frame)}>
      <Head d={d} title={`${d.weekday.slice(0, 3)} ${d.date}`} label="KICKOFFS" />
      <div style={col({ gap: rows.length > 7 ? 8 : 12 })}>
        <ColHeads size={size} />
        {rows.map((r) => (
          <BoardRow key={r.id} r={r} size={size} />
        ))}
        {more > 0 ? <div style={{ display: "flex", fontFamily: MONO, fontWeight: 700, fontSize: 22, color: MUTED }}>{`+${more} MORE IN THE PLAN`}</div> : null}
      </div>
      <Foot d={d} left="YOU NEED" />
    </div>
  );
}

export function DeparturesCrunch({ d }: { d: XData }) {
  const c = d.crunch;
  if (!c) return <DeparturesSlate d={d} />;
  return (
    <div style={col(frame)}>
      <Head d={d} title={`${c.rows.length} at once`} size={92} label={`${d.weekday.toUpperCase()} · ${c.fromLabel} TO ${c.toLabel} ${d.tzLabel}`} />
      <div style={col({ gap: 18, flexGrow: 1, justifyContent: "center" })}>
        <ColHeads size={35} />
        {c.rows.slice(0, 5).map((r) => (
          <BoardRow key={r.id} r={r} size={35} />
        ))}
      </div>
      <Foot d={d} left="ALL OF IT ON" />
    </div>
  );
}

export function DeparturesCover({ d }: { d: XData }) {
  const total = d.rows.length;
  const lines = [...d.services.filter((s) => !s.free), ...(d.free ? [d.free] : [])];
  return (
    <div style={col(frame)}>
      <Head d={d} title={`${d.weekday} takes`} label={`${total} GAMES · ${d.date.toUpperCase()}`} />
      <div style={col({ gap: 26, flexGrow: 1, justifyContent: "center" })}>
        {lines.map((s) => (
          <div key={s.id} style={row({ gap: 28, alignItems: "center" })}>
            <Flaps text={s.name} size={58} n={12} color={s.free ? MUTED : CREAM} />
            <Flaps text={`${s.games} of ${total}`} size={58} n={8} color={AMBER} />
            {s.free ? <Flaps text="free" size={58} n={4} color={MUTED} /> : null}
          </div>
        ))}
      </div>
      <div style={row({ justifyContent: "space-between" })}>
        <div style={{ display: "flex", fontFamily: MONO, fontWeight: 700, fontSize: 24, color: MUTED }}>CHANNELS AND BLACKOUTS FOR WHERE YOU LIVE</div>
        <div style={{ display: "flex", fontFamily: MONO, fontWeight: 700, fontSize: 24, color: CREAM }}>{d.host.toUpperCase()}</div>
      </div>
    </div>
  );
}
