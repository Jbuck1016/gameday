// How the browser's settings and an account's saved settings combine.
// The first time a device signs in to an account, the two are merged (nothing the visitor did
// before signing in is lost). After that the account is the source of truth on that device.

import type { AccountPrefs, PlanItem } from "@/lib/types";

const KEEP_PAST_MS = 14 * 86_400_000;

/** Drop plan items that ended more than two weeks ago, and duplicates. */
export function prunePlan(plan: PlanItem[], now = Date.now()): PlanItem[] {
  const seen = new Set<string>();
  const out: PlanItem[] = [];
  for (const i of plan) {
    if (seen.has(i.eventId)) continue;
    if (Date.parse(i.start) < now - KEEP_PAST_MS) continue;
    seen.add(i.eventId);
    out.push(i);
  }
  return out.sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
}

/** First sign-in on a device: account settings win where set, plans are combined. */
export function mergeFirstSignIn(local: AccountPrefs, account: AccountPrefs, now = Date.now()): AccountPrefs {
  const byId = new Map<string, PlanItem>();
  for (const i of local.plan) byId.set(i.eventId, i);
  for (const i of account.plan) byId.set(i.eventId, i); // account's priority wins on a clash
  return {
    area: account.area ?? local.area,
    localTeams: account.localTeams.length ? account.localTeams : local.localTeams,
    services: account.services.length ? account.services : local.services,
    spanish: account.spanish || local.spanish,
    theme: account.theme,
    tz: account.tz || local.tz,
    plan: prunePlan(Array.from(byId.values()), now),
  };
}

export function samePrefs(a: AccountPrefs, b: AccountPrefs): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
