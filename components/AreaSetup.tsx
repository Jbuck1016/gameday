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

/** One quiet line under the day header: where listings are for, and a way to confirm or change it. */
export function AreaBanner() {
  const { prefs, update } = usePrefs();
  const auto = useAutoArea();
  if (!prefs.area) {
    if (auto === "loading") return <p className="text-sm text-muted">Finding your area…</p>;
    return (
      <p className="text-sm text-muted">
        Channels depend on where you watch.{" "}
        <a href="/area" className="link">
          Set your area
        </a>
      </p>
    );
  }
  if (prefs.area.confirmed) return null;
  const teams = prefs.localTeams.map((t) => t.name.replace(/^(Los Angeles|LA) /, "")).join(", ");
  return (
    <p className="text-sm text-muted" role="region" aria-label="Your area">
      Listings for {prefs.area.label}
      {teams ? `, local teams ${teams}` : ", no local teams nearby"}.{" "}
      <button
        type="button"
        className="link"
        onClick={() => {
          update((p) => ({ ...p, area: p.area ? { ...p.area, confirmed: true } : p.area }));
          track("area_confirmed", { teams: prefs.localTeams.length });
        }}
      >
        Looks right
      </button>
      {" · "}
      <a href="/area" className="link">
        Change
      </a>
    </p>
  );
}
