"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { Game, Priority, StoredPlan } from "@/lib/types";
import { usePrefs } from "@/lib/prefs";
import { PlanView } from "./PlanView";
import { track } from "@/lib/track";

/** Read-only view of a shared plan, shown as its owner set it up (their area, services, theme unless overridden). */
export function SharedPlan({ plan, games, day, days }: { plan: StoredPlan; games: Game[]; day: string; days: string[] }) {
  const router = useRouter();
  const { theme, overrideTheme } = usePrefs();
  useEffect(() => {
    overrideTheme(plan.theme);
    return () => overrideTheme(null);
  }, [plan.theme, overrideTheme]);
  useEffect(() => {
    track("shared_plan_viewed", { slug: plan.slug, games: plan.items.length });
  }, [plan.slug, plan.items.length]);
  const priorities = useMemo(() => new Map<string, Priority>(plan.items.map((i) => [i.eventId, i.priority])), [plan.items]);
  return (
    <PlanView
      games={games}
      priorities={priorities}
      day={day}
      days={days}
      onDay={(d) => router.push(`/p/${plan.slug}?day=${d}`)}
      tz={plan.timezone}
      themeId={theme}
      myServices={plan.services}
      areaLabel={plan.areaLabel}
      readOnly
    />
  );
}

export function MakeYourOwn({ slug }: { slug: string }) {
  return (
    <div className="panel flex flex-wrap items-center justify-between gap-3 p-4">
      <p className="text-sm">Plan your own day, with channels and blackouts for where you live.</p>
      <a href="/" className="btn btn-primary no-underline" onClick={() => track("make_your_own_clicked", { slug })}>
        Make my plan
      </a>
    </div>
  );
}
