"use client";

import type { Game, OutletOption } from "@/lib/types";

const BASIS_LABEL: Record<OutletOption["basis"], string> = {
  national: "National",
  local_team: "Your local team",
  out_of_market: "Out-of-market package",
  likely: "Likely",
};

function confidenceTag(o: OutletOption) {
  if (o.confidence === "likely") return <span className="chip dashed text-muted">Likely, not announced</span>;
  if (o.confidence === "regional") return <span className="chip text-muted">Regional, may not air in your area</span>;
  if (o.confidence === "blacked_out") return <span className="chip text-muted">Blacked out</span>;
  return null;
}

/** Every way to watch a game, grouped by channel, with the visitor's services marked. */
export function WatchList({ game, myServices }: { game: Game; myServices: string[] }) {
  const mine = new Set(myServices);
  if (!game.outlets.length) {
    return <p className="text-sm text-muted">Channel TBA. Listings usually appear a few days before the game.</p>;
  }
  return (
    <ul className="space-y-3">
      {game.outlets.map((o) => {
        const watchable = o.services.filter((s) => s.status !== "not_available");
        const notOn = o.services.filter((s) => s.status === "not_available");
        return (
          <li key={`${o.basis}-${o.outlet}`} className={o.confidence === "blacked_out" ? "struck" : ""}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="label text-base text-ink">{o.outlet}</span>
              {o.basis !== "likely" && <span className="text-xs text-muted">{BASIS_LABEL[o.basis]}</span>}
              {confidenceTag(o)}
            </div>
            {o.note && o.confidence !== "likely" && <p className="mt-0.5 text-xs text-muted">{o.note}</p>}
            {watchable.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {watchable.map((s) => (
                  <span
                    key={s.id}
                    className={`chip ${mine.has(s.id) ? "chip-mine" : ""} ${o.confidence === "likely" ? "dashed" : ""}`}
                    title={s.status === "addon" ? `Needs add-on: ${s.addonName ?? ""}` : s.status === "unverified" ? "Not confirmed: check with the provider" : undefined}
                  >
                    {s.name}
                    {s.status === "addon" && <span className="text-muted">add-on</span>}
                    {s.status === "unverified" && <span className="text-muted">check provider</span>}
                  </span>
                ))}
              </div>
            )}
            {notOn.length > 0 && (
              <p className="mt-1 text-xs text-muted">Not on {notOn.map((s) => s.name).join(", ")}</p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
