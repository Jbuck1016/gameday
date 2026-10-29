// Small pieces shared by the X post looks. Satori: flexbox only, inline styles.

import type { CSSProperties } from "react";
import { contrastRatio } from "@/lib/contrast";
import type { Side } from "./data";

export const row = (s: CSSProperties = {}): CSSProperties => ({ display: "flex", flexDirection: "row", ...s });
export const col = (s: CSSProperties = {}): CSSProperties => ({ display: "flex", flexDirection: "column", ...s });

/** Team logo on a white disc (so dark logos read on dark fills), or the abbreviation in team colour. */
export function Logo({ side, size, ring = 0, ringColor = "#FFFFFF", style }: { side: Side; size: number; ring?: number; ringColor?: string; style?: CSSProperties }) {
  const inner = size - ring * 2;
  return (
    <div
      style={{
        display: "flex",
        width: size,
        height: size,
        borderRadius: size,
        background: "#FFFFFF",
        border: ring ? `${ring}px solid ${ringColor}` : "none",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        ...style,
      }}
    >
      {side.logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={side.logo} width={Math.round(inner * 0.74)} height={Math.round(inner * 0.74)} alt="" style={{ objectFit: "contain" }} />
      ) : (
        <div style={{ display: "flex", fontSize: Math.round(inner * 0.32), fontWeight: 800, color: contrastRatio(side.color, "#FFFFFF") >= 3 ? side.color : "#111318", letterSpacing: -0.5 }}>{side.abbr.slice(0, 4)}</div>
      )}
    </div>
  );
}

export function sideLabel(s: Side, abbr = false): string {
  return `${s.rank ? `#${s.rank} ` : ""}${abbr ? s.abbr : s.short}`;
}
