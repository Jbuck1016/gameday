"use client";

import { useMemo } from "react";
import type { Game, Priority, ThemeId } from "@/lib/types";
import { THEMES } from "@/lib/themes";
import { buildDayModel, type DayModel } from "@/lib/plan";
import { fillSuggestions } from "@/lib/schedule/multiview";
import { gameWindow } from "@/lib/schedule/duration";
import { watchableServices, matchupLabel } from "@/lib/games";
import { formatDayLabel } from "@/lib/time";
import { Timeline } from "./Timeline";
import { WatchList } from "./WatchList";
import { PickButton, Matchup } from "./GameRow";

type Props = {
  games: Game[];
  priorities: Map<string, Priority>;
  day: string;
  days: string[];
  onDay?: (d: string) => void;
  tz: string;
  themeId: ThemeId;
  myServices: string[];
  areaLabel: string | null;
  readOnly?: boolean;
  live?: Map<string, string>;
  onPriority?: (g: Game, p: Priority | null) => void;
  serviceNames?: Map<string, string>;
};

function MultiviewPanel({
  model,
  candidates,
  myServices,
  themeId,
  names,
  onAdd,
}: {
  model: DayModel;
  candidates: Game[];
  myServices: string[];
  themeId: ThemeId;
  names: Map<string, string>;
  onAdd?: (g: Game) => void;
}) {
  const theme = THEMES[themeId];
  const byId = new Map(model.games.map((d) => [d.game.id, d]));
  const cand = candidates.map((g) => {
    const w = gameWindow(g.start, g.durationMin, g.status);
    return { g, id: g.id, start: w.start, end: w.end, services: watchableServices(g) };
  });
  if (!model.multiview.length) {
    return <p className="text-sm text-muted">No overlaps: one screen covers the whole day.</p>;
  }
  return (
    <ul className="space-y-6">
      {model.multiview.map((w) => {
        const fills = onAdd ? fillSuggestions(w, cand, myServices) : [];
        const shown = w.gameIds.slice(0, 4);
        return (
          <li key={w.from}>
            <p className="text-sm font-semibold">
              {theme.formatTime(w.from, model.tz)} to {theme.formatTime(w.to, model.tz)} · {w.gameIds.length} games
            </p>
            <p className="mt-1 text-sm">
              {w.verdict === "single_service" &&
                `All on ${w.commonServices.map((s) => names.get(s) ?? s).join(" or ")}${myServices.length ? ", which you have" : ""}: one multiview covers it.`}
              {w.verdict === "split" && "These games are on different services: you'll need a second screen or app switching."}
              {w.verdict === "over_four" &&
                `More than four at once. Drop ${w.drop.map((id) => matchupLabel(byId.get(id)!.game)).join(", ")} to fit a quad box.`}
            </p>
            <div className="mt-2 grid max-w-md grid-cols-2 gap-1" aria-label="Multiview layout">
              {[0, 1, 2, 3].map((i) => {
                const d = shown[i] ? byId.get(shown[i]) : undefined;
                return (
                  <div key={i} className={`flex aspect-video flex-col justify-center p-2 text-xs ${d ? "bg-surface2" : "border border-dashed border-line text-muted"}`}>
                    {d ? (
                      <>
                        <span className="label">{matchupLabel(d.game)}</span>
                        <span className="text-muted">{d.best?.outlet ?? "TBA"}</span>
                      </>
                    ) : (
                      "Free screen"
                    )}
                  </div>
                );
              })}
            </div>
            {fills.length > 0 && (
              <div className="mt-2 text-sm">
                <p className="text-muted">Fill a screen with:</p>
                <ul className="mt-1 flex flex-wrap gap-2">
                  {fills.map((id) => {
                    const g = candidates.find((c) => c.id === id)!;
                    return (
                      <li key={id}>
                        <button type="button" className="btn min-h-9 text-xs" onClick={() => onAdd?.(g)}>
                          + {matchupLabel(g)}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function PlanView(p: Props) {
  const theme = THEMES[p.themeId];
  const model = useMemo(
    () => buildDayModel(p.games, p.priorities, p.day, p.tz, p.myServices, p.live),
    [p.games, p.priorities, p.day, p.tz, p.myServices, p.live],
  );
  const names = useMemo(() => {
    const m = new Map(p.serviceNames ?? []);
    for (const g of p.games) for (const o of g.outlets) for (const s of o.services) if (!m.has(s.id)) m.set(s.id, s.name);
    return m;
  }, [p.games, p.serviceNames]);
  const candidates = useMemo(() => p.games.filter((g) => !p.priorities.has(g.id)), [p.games, p.priorities]);
  const musts = model.games.filter((d) => d.priority === "must").length;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="display text-3xl">{formatDayLabel(p.day)}</h1>
        <p className="mt-1 text-sm text-muted">
          {model.games.length} {model.games.length === 1 ? "game" : "games"} · {musts} must
          {model.overlaps.length ? ` · ${model.overlaps.length} ${model.overlaps.length === 1 ? "clash" : "clashes"}` : ""}
          {p.areaLabel ? ` · ${p.areaLabel}` : ""}
        </p>
      </header>

      {p.days.length > 1 && (
        <nav aria-label="Plan days" className="flex flex-wrap gap-1.5">
          {p.days.map((d) => (
            <button key={d} type="button" className="btn h-9 min-h-9 px-3 text-xs" aria-pressed={d === p.day} onClick={() => p.onDay?.(d)}>
              {formatDayLabel(d, "short")}
            </button>
          ))}
        </nav>
      )}

      {model.games.length === 0 ? (
        <p className="panel p-6 text-sm text-muted">Nothing planned for this day yet.</p>
      ) : (
        <Timeline model={model} theme={theme} />
      )}

      <section aria-labelledby="games-h">
        <h2 id="games-h" className="label mb-2 text-sm text-muted">
          The games
        </h2>
        <ul className="divide-y divide-line border-y border-line">
          {model.games.map((d) => {
            const g = d.game;
            return (
              <li key={g.id} className="py-4" data-testid="plan-game">
                <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
                  <div className="w-14 shrink-0">
                    <div className="text-[15px] font-bold">{g.timeValid ? theme.formatTime(d.start, p.tz).replace(/ (AM|PM)$/, "") : "TBC"}</div>
                    <div className="text-[11px] font-medium text-muted">
                      to ~{theme.formatTime(d.end, p.tz).replace(/ (AM|PM)$/, "")}
                      {d.runningLong ? " · long" : ""}
                    </div>
                    {p.live?.get(g.id) === "in" && <div className="chip chip-good mt-1">Live</div>}
                  </div>
                  <div className="min-w-0 flex-1 basis-64">
                    <div className="flex flex-wrap items-center gap-2">
                      <Matchup game={g} />
                      <span className={`chip ${d.priority === "must" ? "bg-ink text-ground" : ""}`}>{d.priority === "must" ? "Must" : "Want"}</span>
                    </div>
                    <p className="mt-0.5 text-sm text-muted">{[g.leagueName, g.venue].filter(Boolean).join(" · ")}</p>
                    {!g.timeValid && <p className="mt-0.5 text-sm text-muted">Kickoff time not confirmed yet.</p>}
                    <div className="mt-3">
                      <WatchList game={g} myServices={p.myServices} />
                    </div>
                  </div>
                  {!p.readOnly && p.onPriority && (
                    <PickButton game={g} priority={d.priority} onChange={(pr) => p.onPriority!(g, pr)} />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {model.games.length > 0 && (
        <section aria-labelledby="svc-h" className="panel p-4">
          <h2 id="svc-h" className="text-[11px] font-semibold tracking-wide text-muted">
            YOU NEED
          </h2>
          {model.cover.chosen.length ? (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {model.cover.chosen.map((s) => (
                <li key={s} className={`chip ${p.myServices.includes(s) ? "chip-mine" : ""}`}>
                  {names.get(s) ?? s}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted">No confirmed services yet for these games.</p>
          )}
          {model.cover.mustNotCoveredByMine.length > 0 && (
            <p className="mt-3 text-sm">
              None of your services carry:{" "}
              {model.cover.mustNotCoveredByMine.map((id) => matchupLabel(model.games.find((d) => d.game.id === id)!.game)).join(", ")}.
            </p>
          )}
          {p.myServices.length === 0 && !p.readOnly && (
            <p className="mt-3 text-sm text-muted">
              Tell us which services you have in <a href="/settings" className="link">Settings</a> to see which games you already get.
            </p>
          )}
        </section>
      )}

      {model.games.length > 1 && (
        <section aria-labelledby="mv-h">
          <h2 id="mv-h" className="label mb-3 text-sm text-muted">
            Multiview
          </h2>
          <MultiviewPanel
            model={model}
            candidates={candidates}
            myServices={p.myServices}
            themeId={p.themeId}
            names={names}
            onAdd={p.readOnly || !p.onPriority ? undefined : (g) => p.onPriority!(g, "want")}
          />
        </section>
      )}
    </div>
  );
}
