import "server-only";
import { z } from "zod";
import { idList } from "@/lib/server/http";
import { isValidTimezone } from "@/lib/time";

const TeamPref = z.object({ id: idList.element, name: z.string().max(120), leagueId: z.string().max(40) });
const PlanItem = z.object({
  eventId: idList.element,
  priority: z.enum(["must", "want"]),
  start: z.string().datetime({ offset: true }),
  leagueId: z.string().max(40),
  name: z.string().max(200),
});

export const AccountPrefsSchema = z.object({
  area: z
    .object({ label: z.string().max(80), source: z.enum(["ip", "zip"]), zip: z.string().max(10).nullable(), confirmed: z.boolean() })
    .nullable(),
  localTeams: z.array(TeamPref).max(30),
  services: z.array(z.string().regex(/^[a-z0-9_]+$/)).max(30),
  spanish: z.boolean(),
  theme: z.enum(["broadcast", "editorial", "terminal"]),
  tz: z.string().max(64).refine(isValidTimezone),
  plan: z.array(PlanItem).max(300),
});
