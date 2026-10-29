"use client";

import { useState } from "react";
import type { TeamLite } from "@/lib/types";

/** A team's logo on a white disc (so dark logos read on any colour), or its abbreviation. */
export function TeamDisc({ team, size, className = "" }: { team: TeamLite | null; size: number; className?: string }) {
  const [failed, setFailed] = useState(false);
  const px = `${size}px`;
  const inner = Math.round(size * 0.72);
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-full bg-white ${className}`} style={{ width: px, height: px }} aria-hidden="true">
      {team?.logo && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={team.logo} alt="" width={inner} height={inner} loading="lazy" onError={() => setFailed(true)} style={{ width: inner, height: inner, objectFit: "contain" }} />
      ) : (
        <span className="text-[10px] font-extrabold text-[#111318]">{(team?.abbr ?? "").slice(0, 4)}</span>
      )}
    </span>
  );
}

/** Both teams side by side, a small gap between them (never overlapping). */
export function TeamPair({ first, second, size, gap = 4 }: { first: TeamLite | null; second: TeamLite | null; size: number; gap?: number }) {
  return (
    <span className="flex shrink-0 items-center" style={{ gap }}>
      <TeamDisc team={first} size={size} />
      <TeamDisc team={second} size={size} />
    </span>
  );
}
