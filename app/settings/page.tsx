"use client";

import Link from "next/link";
import { usePrefs } from "@/lib/prefs";
import { AccountSection } from "@/components/AccountSection";

const GROUPS: { title: string; kinds: string[] }[] = [
  { title: "Live TV", kinds: ["live_tv"] },
  { title: "Streaming", kinds: ["streaming"] },
  { title: "Packages", kinds: ["add_on"] },
  { title: "Free", kinds: ["free"] },
];

// team-specific apps are offered on the plan screen when relevant, not here
const HIDE = new Set(["clippervision_app", "spectrum_sportsnet_plus", "dazn"]);

export default function SettingsPage() {
  const { prefs, update, meta, account } = usePrefs();
  const services = (meta?.services ?? []).filter((s) => !HIDE.has(s.id));
  const toggle = (id: string) =>
    update((p) => ({ ...p, services: p.services.includes(id) ? p.services.filter((s) => s !== id) : [...p.services, id] }));

  return (
    <div className="mx-auto max-w-2xl space-y-10">
      <header>
        <p className="label text-sm text-accent">Settings</p>
        <h1 className="display text-4xl sm:text-5xl">Make it yours</h1>
        <p className="mt-2 text-sm text-muted">{account ? "Saved to your account." : "Saved in this browser."}</p>
      </header>

      <AccountSection />

      <section aria-labelledby="area-h" className="panel p-4">
        <h2 id="area-h" className="label text-sm text-muted">
          Area and local teams
        </h2>
        <p className="mt-2">{prefs.area?.label ?? "Not set"}</p>
        <p className="mt-1 text-sm text-muted">{prefs.localTeams.map((t) => t.name).join(", ") || "No local teams"}</p>
        <Link href="/area" className="btn mt-3 no-underline">
          Change
        </Link>
      </section>

      <section aria-labelledby="svc-h">
        <h2 id="svc-h" className="label text-sm text-muted">
          Services you have
        </h2>
        <p className="mt-1 text-sm text-muted">We&apos;ll highlight games you already get, and flag must-watch games you don&apos;t.</p>
        <div className="mt-4 space-y-5">
          {GROUPS.map((grp) => {
            const list = services.filter((s) => grp.kinds.includes(s.kind));
            if (!list.length) return null;
            return (
              <fieldset key={grp.title}>
                <legend className="label mb-2 text-xs text-muted">{grp.title}</legend>
                <div className="flex flex-wrap gap-2">
                  {list.map((s) => (
                    <label key={s.id} className={`chip min-h-11 cursor-pointer px-3 ${prefs.services.includes(s.id) ? "chip-mine" : ""}`}>
                      <input type="checkbox" className="sr-only" checked={prefs.services.includes(s.id)} onChange={() => toggle(s.id)} />
                      {s.name}
                    </label>
                  ))}
                </div>
              </fieldset>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="lang-h">
        <h2 id="lang-h" className="label text-sm text-muted">
          Spanish-language channels
        </h2>
        <label className="mt-2 flex min-h-11 items-center gap-3">
          <input type="checkbox" checked={prefs.spanish} onChange={(e) => update((p) => ({ ...p, spanish: e.target.checked }))} />
          Show Telemundo, Universo, ESPN Deportes and other Spanish-language channels
        </label>
        <p className="text-sm text-muted">They always show when they&apos;re the only way to watch a game.</p>
      </section>

      <section aria-labelledby="tz-h">
        <h2 id="tz-h" className="label text-sm text-muted">
          Time zone
        </h2>
        <p className="mt-2 text-sm">{prefs.tz}</p>
      </section>
    </div>
  );
}
