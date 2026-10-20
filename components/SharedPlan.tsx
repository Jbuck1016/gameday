"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { Game, Priority, StoredPlan } from "@/lib/types";
import { usePrefs } from "@/lib/prefs";
import { PlanView } from "./PlanView";

/** Read-only view of a shared plan, shown as its owner set it up (their area, services, theme unless overridden). */
export function SharedPlan({ plan, games, day, days }: { plan: StoredPlan; games: Game[]; day: string; days: string[] }) {
  const router = useRouter();
  const { theme, overrideTheme } = usePrefs();
  useEffect(() => {
    overrideTheme(plan.theme);
    return () => overrideTheme(null);
  }, [plan.theme, overrideTheme]);
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
