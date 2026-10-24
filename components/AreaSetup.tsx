"use client";

import { useEffect, useState } from "react";
import { usePrefs, type LocalTeamPref } from "@/lib/prefs";
import type { LocalTeam } from "@/lib/types";
import { track } from "@/lib/track";

type AreaResult = { source: "ip" | "zip" | "none"; label: string | null; zip: string | null; teams: LocalTeam[] };

export async function fetchArea(zip?: string): Promise<AreaResult> {
  const res = await fetch(zip ? `/api/area?zip=${encodeURIComponent(zip)}` : "/api/area");
  const j = await res.json();
  if (!res.ok) throw new Error(j.error ?? "Couldn't look up that area");
  return j as AreaResult;
}

export function toPrefTeams(teams: LocalTeam[]): LocalTeamPref[] {
  return teams.map((t) => ({ id: t.team_id, name: t.team_name, leagueId: t.league_id }));
}

/** On a first visit, detect the area from the connection and suggest local teams (unconfirmed). */
export function useAutoArea() {
  const { ready, prefs, update } = usePrefs();
  const [state, setState] = useState<"idle" | "loading" | "failed">("idle");
  useEffect(() => {
    if (!ready || prefs.area || state !== "idle") return;
    setState("loading");
    fetchArea()
      .then((a) => {
        if (a.source === "none" || !a.label) {
          setState("failed");
          return;
        }
        update((p) => ({
          ...p,
          area: { label: a.label!, source: "ip", zip: null, confirmed: false },
          localTeams: toPrefTeams(a.teams),
        }));
        track("area_set", { method: "ip" });
        setState("idle");
      })
      .catch(() => setState("failed"));
  }, [ready, prefs.area, state, update]);
  return state;
}

export function AreaBanner() {
  const { prefs, update } = usePrefs();
  const auto = useAutoArea();
  if (!prefs.area) {
    if (auto === "loading") return <div className="panel mb-6 p-4 text-sm text-muted">Finding your area…</div>;
    return (
      <div className="panel mb-6 flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="text-sm">Set your area so channels, local teams and blackouts match where you watch.</p>
        <a href="/area" className="btn btn-primary no-underline">
          Set your area
        </a>
      </div>
    );
  }
  if (prefs.area.confirmed) return null;
  return (
    <div className="panel mb-6 p-4" role="region" aria-label="Your area">
      <p className="label text-sm text-accent">Showing listings for {prefs.area.label}</p>
      <p className="mt-1 text-sm">
        {prefs.localTeams.length
          ? `Your local teams: ${prefs.localTeams.map((t) => t.name).join(", ")}.`
          : "No pro teams nearby, so every game uses national listings."}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            update((p) => ({ ...p, area: p.area ? { ...p.area, confirmed: true } : p.area }));
            track("area_confirmed", { teams: prefs.localTeams.length });
          }}
        >
          Looks right
        </button>
        <a href="/area" className="btn no-underline">
          Change
        </a>
      </div>
    </div>
  );
}
