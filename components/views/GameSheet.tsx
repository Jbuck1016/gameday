"use client";

import { useEffect, useRef } from "react";
import type { Game, Priority } from "@/lib/types";
import { matchupLabel } from "@/lib/games";
import { WatchList } from "../WatchList";
import { PickButton } from "../GameRow";
import { TeamPair } from "./TeamDisc";
import { sides } from "./shared";

/**
 * Every way to watch one game, in a native modal dialog (focus is trapped and returned,
 * Escape closes). Opened by tapping a game in any of the three views.
 */
export function GameSheet({
  game,
  time,
  myServices,
  priority,
  onPriority,
  onClose,
}: {
  game: Game | null;
  time: string;
  myServices: string[];
  priority: Priority | null;
  onPriority: (p: Priority | null) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (game && !d.open) d.showModal();
    if (!game && d.open) d.close();
  }, [game]);

  const s = game ? sides(game) : null;
  return (
    <dialog
      ref={ref}
      aria-labelledby="sheet-title"
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-2xl bg-surface p-0 text-ink shadow-2xl backdrop:bg-[rgba(17,19,24,0.45)] max-sm:mb-0 max-sm:w-full max-sm:max-w-none max-sm:rounded-b-none"
    >
      {game && s ? (
        <div className="flex flex-col gap-4 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <div className="flex items-start gap-3">
            <TeamPair first={s.first} second={s.second} size={40} />
            <div className="min-w-0 flex-1">
              <h2 id="sheet-title" className="text-lg font-extrabold leading-tight">
                {matchupLabel(game)}
              </h2>
              <p className="text-sm text-muted">
                {time} · {game.leagueName}
              </p>
            </div>
            <button type="button" className="btn h-11 min-h-11 w-11 p-0" aria-label="Close" onClick={onClose}>
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
          <WatchList game={game} myServices={myServices} />
          {game.venue && <p className="text-xs text-muted">{game.venue}</p>}
          <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
            <span className="text-sm text-muted">{priority === "must" ? "Must watch" : priority === "want" ? "Want to watch" : "Not in your plan"}</span>
            <PickButton game={game} priority={priority} onChange={onPriority} />
          </div>
        </div>
      ) : null}
    </dialog>
  );
}
