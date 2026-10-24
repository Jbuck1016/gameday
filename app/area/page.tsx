"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { usePrefs, type LocalTeamPref } from "@/lib/prefs";
import { fetchArea, toPrefTeams } from "@/components/AreaSetup";
import { TeamSearch } from "@/components/TeamSearch";
import { track } from "@/lib/track";

export default function AreaPage() {
  const router = useRouter();
  const { ready, prefs, update } = usePrefs();
  const [label, setLabel] = useState<string | null>(null);
  const [zip, setZip] = useState("");
  const [teams, setTeams] = useState<LocalTeamPref[]>([]);
  const [source, setSource] = useState<"ip" | "zip">("ip");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (prefs.area) {
      setLabel(prefs.area.label);
      setTeams(prefs.localTeams);
      setSource(prefs.area.source);
      setZip(prefs.area.zip ?? "");
      return;
    }
    setBusy(true);
    fetchArea()
      .then((a) => {
        if (a.source === "none" || !a.label) {
          setStatus("We couldn't tell where you are. Enter your zip code.");
          return;
        }
        setLabel(a.label);
        setTeams(toPrefTeams(a.teams));
        setSource("ip");
      })
      .catch(() => setStatus("We couldn't tell where you are. Enter your zip code."))
      .finally(() => setBusy(false));
  }, [ready, prefs.area, prefs.localTeams]);

  async function lookupZip(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    try {
      const a = await fetchArea(zip.trim());
      setLabel(a.label);
      setTeams(toPrefTeams(a.teams));
      setSource("zip");
    } catch (err) {
      setStatus((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function saveArea() {
    if (!label) return;
    update((p) => ({ ...p, area: { label, source, zip: source === "zip" ? zip.trim() : null, confirmed: true }, localTeams: teams }));
    track("area_set", { method: source });
    track("local_teams_edited", { count: teams.length });
    router.push("/");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <header>
        <p className="label text-sm text-accent">Your area</p>
        <h1 className="display text-4xl sm:text-5xl">Where do you watch?</h1>
        <p className="mt-2 text-muted">
          Your area decides your local teams. Local teams decide which regional channels you see and which games are blacked out.
        </p>
      </header>

      <section className="panel p-4">
        {busy && !label && <p className="text-sm text-muted">Finding your area…</p>}
        {label && (
          <p className="text-lg">
            <span className="text-muted">{source === "ip" ? "Detected:" : "Zip:"}</span> <strong>{label}</strong>
          </p>
        )}
        <form onSubmit={lookupZip} className="mt-3 flex flex-wrap items-end gap-2">
          <div>
            <label htmlFor="zip" className="label mb-1 block text-sm text-muted">
              {label ? "Not right? Enter your zip" : "Your zip code"}
            </label>
            <input
              id="zip"
              className="input w-36"
              inputMode="numeric"
              pattern="[0-9]{5}"
              maxLength={5}
              value={zip}
              onChange={(e) => setZip(e.target.value.replace(/\D/g, ""))}
            />
          </div>
          <button type="submit" className="btn" disabled={zip.length !== 5 || busy}>
            Look up
          </button>
        </form>
        {status && (
          <p className="mt-2 text-sm" role="status">
            {status}
          </p>
        )}
      </section>

      <section aria-labelledby="lt-h" className="space-y-3">
        <h2 id="lt-h" className="label text-sm text-muted">
          Your local teams
        </h2>
        {teams.length === 0 ? (
          <p className="text-sm text-muted">None yet. Teams within about 100 miles are suggested automatically; add any others below.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {teams.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  className="chip min-h-11 px-3"
                  onClick={() => setTeams((ts) => ts.filter((x) => x.id !== t.id))}
                  aria-label={`Remove ${t.name}`}
                >
                  {t.name} <span aria-hidden>×</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <TeamSearch
          exclude={teams.map((t) => t.id)}
          onPick={(t) => setTeams((ts) => [...ts, { id: t.id, name: t.name, leagueId: t.league_id }])}
        />
      </section>

      <div className="flex gap-2">
        <button type="button" className="btn btn-primary" onClick={saveArea} disabled={!label}>
          Save
        </button>
        <button type="button" className="btn" onClick={() => router.back()}>
          Cancel
        </button>
      </div>
    </div>
  );
}
