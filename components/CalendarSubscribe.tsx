"use client";

import { useEffect, useState } from "react";
import { usePrefs, type LocalTeamPref } from "@/lib/prefs";
import { track, visitorId } from "@/lib/track";

/** Turn a set of teams into a calendar the visitor subscribes to once; channels fill in as they're announced. */
export function CalendarSubscribe({ teams }: { teams: LocalTeamPref[] }) {
  const { prefs } = usePrefs();
  const key = teams.map((t) => t.id).join(",");
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // a different set of teams needs a new calendar
  useEffect(() => {
    setUrl(null);
    setMsg(null);
  }, [key]);

  if (!teams.length) return null;

  const create = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/feeds", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          teamIds: teams.map((t) => t.id),
          localTeamIds: prefs.localTeams.map((t) => t.id),
          services: prefs.services,
          spanish: prefs.spanish,
          label: teams.map((t) => t.name).join(", ").slice(0, 120),
          visitor: visitorId(),
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Couldn't create the calendar");
      setUrl(`${window.location.host}${j.path}?tz=${encodeURIComponent(prefs.tz)}`);
      track("calendar_created", { teams: teams.length });
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const webcal = url ? `webcal://${url}` : "";
  const https = url ? `https://${url}` : "";
  const google = url ? `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcal)}` : "";

  return (
    <section aria-labelledby="cal-h" className="panel space-y-3 p-4" data-testid="calendar-subscribe">
      <h2 id="cal-h" className="label text-sm text-accent">
        Follow in your calendar
      </h2>
      <p className="text-sm">
        Every game for {teams.length === 1 ? teams[0].name : "these teams"} in your phone or computer calendar, with where to watch in
        your area. Channels fill in by themselves as they&apos;re announced.
      </p>
      {!url ? (
        <button type="button" className="btn btn-primary" onClick={create} disabled={busy}>
          {busy ? "Creating…" : "Create calendar"}
        </button>
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <a className="btn btn-primary no-underline" href={webcal} onClick={() => track("calendar_subscribed", { app: "webcal" })}>
              Apple or Outlook
            </a>
            <a
              className="btn no-underline"
              href={google}
              target="_blank"
              rel="noreferrer"
              onClick={() => track("calendar_subscribed", { app: "google" })}
            >
              Google Calendar
            </a>
            <button
              type="button"
              className="btn"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(https);
                  setMsg("Link copied. In your calendar app, add a calendar from a URL and paste it.");
                } catch {
                  setMsg(`Calendar link: ${https}`);
                }
                track("calendar_subscribed", { app: "copy" });
              }}
            >
              Copy link
            </button>
          </div>
          <p className="text-xs text-muted">Google Calendar can take several hours to pick up changes to a subscribed calendar.</p>
        </div>
      )}
      {msg && (
        <p className="break-all text-sm" role="status">
          {msg}
        </p>
      )}
    </section>
  );
}
