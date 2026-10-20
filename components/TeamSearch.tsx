"use client";

import { useEffect, useState } from "react";
import type { Team } from "@/lib/types";
import { TeamMark } from "./GameRow";

/** Type-ahead team search; calls onPick with the chosen team. */
export function TeamSearch({ onPick, exclude = [], label = "Add a team", id = "team-search" }: { onPick: (t: Team) => void; exclude?: string[]; label?: string; id?: string }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      setLoading(true);
      fetch(`/api/teams?q=${encodeURIComponent(term)}`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then((j) => setResults((j.teams as Team[]) ?? []))
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 200);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  const shown = results.filter((r) => !exclude.includes(r.id));
  return (
    <div>
      <label htmlFor={id} className="label mb-1 block text-sm text-muted">
        {label}
      </label>
      <input id={id} className="input" placeholder="Type a team name" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
      {q.trim().length >= 2 && (
        <ul className="mt-1 max-h-72 overflow-auto border border-line bg-surface" aria-live="polite">
          {loading && !shown.length && <li className="p-3 text-sm text-muted">Searching…</li>}
          {!loading && !shown.length && <li className="p-3 text-sm text-muted">No teams found</li>}
          {shown.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                className="flex min-h-11 w-full items-center gap-2 px-3 text-left hover:bg-surface2"
                onClick={() => {
                  onPick(t);
                  setQ("");
                }}
              >
                <TeamMark logo={t.logo_url} abbr={t.abbreviation ?? t.name} />
                <span>{t.name}</span>
                <span className="ml-auto text-xs text-muted">{t.league_id}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
