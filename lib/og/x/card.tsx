// Look C, "Fight Card": a matchday poster. Each game is a band split in its two teams' colours
// with the kickoff and channel in a tag on the seam; the clash is drawn as an actual quad box.
// Warm paper ground, heavy condensed type, one red for must-watch and the clash.

import { X_H, X_W, freeLine, inkOn, pickRows, type XData, type XRow } from "./data";
import { Logo, col, row } from "./kit";

const PAPER = "#F2EDE3";
const INK = "#121212";
const RED = "#E3301C";
const GOLD = "#FFD23F";
const DISPLAY = "Anton";
const LABEL = "Barlow Condensed";

const up = (s: string) => s.toUpperCase();
const name = (r: XRow, first: boolean) => {
  const s = first ? r.first : r.second;
  return `${s.rank ? `#${s.rank} ` : ""}${up(s.short)}`;
};

function Band({ r, h, w }: { r: XRow; h: number; w: number }) {
  const a = r.first.color;
  const b = r.second.color;
  const nameSize = Math.round(h * 0.38);
  const logo = Math.round(h * 0.72);
  return (
    <div
      style={row({
        width: w,
        height: h,
        alignItems: "center",
        backgroundImage: `linear-gradient(100deg, ${a} 0%, ${a} 50%, ${b} 50%, ${b} 100%)`,
      })}
    >
      <div style={row({ flexGrow: 1, flexBasis: 0, alignItems: "center", gap: 16, paddingLeft: 14, overflow: "hidden" })}>
        <Logo side={r.first} size={logo} />
        <div style={{ display: "flex", fontFamily: DISPLAY, fontSize: nameSize, color: inkOn(a), whiteSpace: "nowrap" }}>{name(r, true)}</div>
      </div>
      <div style={col({ width: 200, height: h, flexShrink: 0, alignItems: "center", justifyContent: "center", background: r.priority === "must" ? RED : INK })}>
        <div style={{ display: "flex", fontFamily: DISPLAY, fontSize: Math.round(h * 0.34), color: "#FFFFFF", lineHeight: 1 }}>{`${r.time} ${r.mer}`}</div>
        <div style={{ display: "flex", fontFamily: LABEL, fontWeight: 700, fontSize: Math.round(h * 0.24), color: GOLD, letterSpacing: 1 }}>{up(r.outlet).slice(0, 16)}</div>
      </div>
      <div style={row({ flexGrow: 1, flexBasis: 0, alignItems: "center", justifyContent: "flex-end", gap: 16, paddingRight: 14, overflow: "hidden" })}>
        <div style={{ display: "flex", fontFamily: DISPLAY, fontSize: nameSize, color: inkOn(b), whiteSpace: "nowrap" }}>{name(r, false)}</div>
        <Logo side={r.second} size={logo} />
      </div>
    </div>
  );
}

const frame = { width: X_W, height: X_H, background: PAPER } as const;

export function CardSlate({ d }: { d: XData }) {
  const rows = pickRows(d.rows, 7);
  const more = d.rows.length - rows.length;
  const bandH = rows.length > 6 ? 98 : 112;
  return (
    <div style={row({ ...frame, padding: "52px 56px 48px", gap: 44 })}>
      <div style={col({ width: 420, flexShrink: 0 })}>
        <div style={{ display: "flex", fontFamily: DISPLAY, fontSize: 250, lineHeight: 0.9, color: INK }}>{up(d.weekday.slice(0, 3))}</div>
        <div style={{ display: "flex", fontFamily: DISPLAY, fontSize: 118, lineHeight: 1, color: RED }}>{up(d.date)}</div>
        <div style={{ display: "flex", fontFamily: LABEL, fontWeight: 700, fontSize: 34, letterSpacing: 5, color: INK, marginTop: 18 }}>{`THE CARD · ${d.rows.length} GAMES`}</div>
        <div style={{ display: "flex", fontFamily: LABEL, fontWeight: 600, fontSize: 28, color: INK, marginTop: 4 }}>{`TIMES ${d.tzLabel} · RED = MUST WATCH`}</div>
        <div style={col({ marginTop: "auto", gap: 6 })}>
          <div style={{ display: "flex", fontFamily: LABEL, fontWeight: 700, fontSize: 26, letterSpacing: 3, color: INK }}>YOU NEED</div>
          <div style={{ display: "flex", fontFamily: DISPLAY, fontSize: 40, color: INK, lineHeight: 1.1 }}>{up(d.services.map((s) => s.name).join(" + "))}</div>
          {d.free && !d.services.some((s) => s.free) ? (
            <div style={{ display: "flex", fontFamily: LABEL, fontWeight: 700, fontSize: 26, color: RED }}>{up(freeLine(d.free))}</div>
          ) : null}
          <div style={col({ gap: 8, marginTop: 16 })}>
            <div style={{ display: "flex", alignSelf: "flex-start", fontFamily: DISPLAY, fontSize: 44, color: PAPER, background: INK, padding: "2px 14px", whiteSpace: "nowrap" }}>GAME DAY</div>
            {d.host ? <div style={{ display: "flex", fontFamily: LABEL, fontWeight: 600, fontSize: 24, color: INK }}>{d.host}</div> : null}
          </div>
        </div>
      </div>
      <div style={col({ flexGrow: 1, gap: 10, justifyContent: "center" })}>
        {rows.map((r) => (
          <Band key={r.id} r={r} h={bandH} w={1024} />
        ))}
        {more > 0 ? <div style={{ display: "flex", fontFamily: LABEL, fontWeight: 700, fontSize: 28, color: INK }}>{`+${more} MORE${d.host ? " IN THE PLAN" : ""}`}</div> : null}
      </div>
    </div>
  );
}

function Quad({ r, w, h }: { r: XRow | null; w: number; h: number }) {
  if (!r)
    return (
      <div style={col({ width: w, height: h, alignItems: "center", justifyContent: "center", background: "#E4DED2" })}>
        <div style={{ display: "flex", fontFamily: DISPLAY, fontSize: 48, color: "#9C9483" }}>OPEN SCREEN</div>
      </div>
    );
  const a = r.first.color;
  const b = r.second.color;
  return (
    <div style={col({ position: "relative", width: w, height: h, backgroundImage: `linear-gradient(135deg, ${a} 0%, ${a} 50%, ${b} 50%, ${b} 100%)` })}>
      <Logo side={r.first} size={140} style={{ position: "absolute", left: 36, top: 36 }} />
      <Logo side={r.second} size={140} style={{ position: "absolute", right: 36, bottom: 36 }} />
      <div style={row({ position: "absolute", left: 0, top: 0, width: w, height: h, alignItems: "center", justifyContent: "center" })}>
        <div style={col({ alignItems: "center", background: INK, padding: "8px 20px" })}>
          <div style={{ display: "flex", fontFamily: DISPLAY, fontSize: 46, color: "#FFFFFF", lineHeight: 1.05 }}>{`${r.first.abbr} ${up(r.sep)} ${r.second.abbr}`}</div>
          <div style={{ display: "flex", fontFamily: LABEL, fontWeight: 700, fontSize: 30, color: GOLD }}>{up(`${r.time} ${r.mer} · ${r.outlet}`)}</div>
        </div>
      </div>
    </div>
  );
}

export function CardCrunch({ d }: { d: XData }) {
  const c = d.crunch;
  if (!c) return <CardSlate d={d} />;
  const qs = [0, 1, 2, 3].map((i) => c.rows[i] ?? null);
  const QW = 540;
  const QH = 450;
  return (
    <div style={row(frame)}>
      <div style={col({ width: QW * 2, height: X_H })}>
        <div style={row({})}>
          <Quad r={qs[0]} w={QW} h={QH} />
          <Quad r={qs[1]} w={QW} h={QH} />
        </div>
        <div style={row({})}>
          <Quad r={qs[2]} w={QW} h={QH} />
          <Quad r={qs[3]} w={QW} h={QH} />
        </div>
      </div>
      <div style={col({ flexGrow: 1, background: INK, padding: "56px 44px 48px" })}>
        <div style={{ display: "flex", fontFamily: DISPLAY, fontSize: 300, lineHeight: 0.85, color: RED }}>{String(c.rows.length)}</div>
        <div style={{ display: "flex", fontFamily: DISPLAY, fontSize: 120, lineHeight: 0.95, color: PAPER }}>AT ONCE</div>
        <div style={{ display: "flex", fontFamily: LABEL, fontWeight: 700, fontSize: 36, color: GOLD, marginTop: 24, letterSpacing: 1 }}>{up(`${d.weekday} ${c.fromLabel} ${d.tzLabel}`)}</div>
        <div style={{ display: "flex", fontFamily: LABEL, fontWeight: 600, fontSize: 30, color: PAPER, marginTop: 6 }}>{up(`until ${c.toLabel}`)}</div>
        <div style={col({ marginTop: "auto", gap: 10 })}>
          <div style={{ display: "flex", fontFamily: DISPLAY, fontSize: 40, color: INK, background: PAPER, padding: "2px 14px", alignSelf: "flex-start" }}>GAME DAY</div>
          {d.host ? <div style={{ display: "flex", fontFamily: LABEL, fontWeight: 600, fontSize: 24, color: PAPER }}>{`PLAN YOUR SCREENS · ${d.host}`}</div> : null}
        </div>
      </div>
    </div>
  );
}

export function CardCover({ d }: { d: XData }) {
  const total = d.rows.length;
  const paid = d.services.filter((s) => !s.free);
  const tickets = [...d.services, ...(d.free && !d.services.some((s) => s.free) ? [d.free] : [])];
  return (
    <div style={row({ ...frame, padding: "40px 64px 48px", gap: 40, alignItems: "center" })}>
      <div style={{ display: "flex", fontFamily: DISPLAY, fontSize: 640, lineHeight: 0.85, color: RED, width: 380, justifyContent: "center" }}>{String(paid.length)}</div>
      <div style={col({ flexGrow: 1, gap: 6 })}>
        <div style={{ display: "flex", fontFamily: DISPLAY, fontSize: 124, lineHeight: 0.95, color: INK }}>{paid.length === 1 ? "SUBSCRIPTION" : "SUBSCRIPTIONS"}</div>
        <div style={{ display: "flex", fontFamily: LABEL, fontWeight: 700, fontSize: 40, color: INK, letterSpacing: 2 }}>{up(`for all ${total} games · ${d.weekday} ${d.date}`)}</div>
        <div style={col({ gap: 16, marginTop: 34 })}>
          {tickets.map((s, i) => (
            <div
              key={s.id}
              style={row({ alignSelf: "flex-start", alignItems: "baseline", gap: 18, background: s.free ? RED : INK, padding: "10px 24px", transform: `rotate(${i % 2 ? 0.8 : -0.8}deg)` })}
            >
              <div style={{ display: "flex", fontFamily: DISPLAY, fontSize: 60, color: PAPER }}>{up(s.name)}</div>
              <div style={{ display: "flex", fontFamily: LABEL, fontWeight: 700, fontSize: 32, color: GOLD }}>{up(`${s.games} ${s.games === 1 ? "game" : "games"}${s.free ? " · free" : ""}`)}</div>
            </div>
          ))}
        </div>
        <div style={row({ alignItems: "center", gap: 12, marginTop: 40 })}>
          <div style={{ display: "flex", fontFamily: DISPLAY, fontSize: 40, color: PAPER, background: INK, padding: "2px 14px" }}>GAME DAY</div>
          {d.host ? <div style={{ display: "flex", fontFamily: LABEL, fontWeight: 600, fontSize: 24, color: INK }}>{`CHANNELS FOR WHERE YOU LIVE · ${d.host}`}</div> : null}
        </div>
      </div>
    </div>
  );
}
