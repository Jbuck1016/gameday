// Time helpers. Everything is stored in UTC; local day boundaries are computed in the viewer's
// timezone with Intl, so DST days (23 or 25 hours) come out right without a date library.

const dtfCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(tz: string): Intl.DateTimeFormat {
  let f = dtfCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    dtfCache.set(tz, f);
  }
  return f;
}

export type ZonedParts = { year: number; month: number; day: number; hour: number; minute: number; second: number };

export function zonedParts(ms: number, tz: string): ZonedParts {
  const out: Record<string, number> = {};
  for (const p of partsFormatter(tz).formatToParts(new Date(ms))) {
    if (p.type !== "literal") out[p.type] = Number(p.value);
  }
  return {
    year: out.year,
    month: out.month,
    day: out.day,
    hour: out.hour === 24 ? 0 : out.hour,
    minute: out.minute,
    second: out.second,
  };
}

/** Offset of tz from UTC at instant ms, in milliseconds (e.g. -7h for PDT). */
export function tzOffsetMs(ms: number, tz: string): number {
  const p = zonedParts(ms, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(ms / 1000) * 1000;
}

/** The UTC instant of a wall-clock time in tz. */
export function zonedToUtc(year: number, month: number, day: number, hour: number, minute: number, tz: string): number {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  let result = guess - tzOffsetMs(guess, tz);
  // second pass corrects instants near a DST change
  result = guess - tzOffsetMs(result, tz);
  return result;
}

export function parseDateKey(key: string): { y: number; m: number; d: number } {
  const [y, m, d] = key.split("-").map(Number);
  return { y, m, d };
}

/** 'YYYY-MM-DD' of instant ms in tz. */
export function dateKey(ms: number, tz: string): string {
  const p = zonedParts(ms, tz);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export function addDays(key: string, n: number): string {
  const { y, m, d } = parseDateKey(key);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

/** [from, to) in UTC for a local calendar day. */
export function localDayRange(key: string, tz: string): { from: Date; to: Date } {
  const { y, m, d } = parseDateKey(key);
  const next = parseDateKey(addDays(key, 1));
  return {
    from: new Date(zonedToUtc(y, m, d, 0, 0, tz)),
    to: new Date(zonedToUtc(next.y, next.m, next.d, 0, 0, tz)),
  };
}

export function todayKey(tz: string, nowMs = Date.now()): string {
  return dateKey(nowMs, tz);
}

/** Minutes after local midnight of the given day key (can exceed 1440 for games past midnight). */
export function minutesIntoDay(ms: number, key: string, tz: string): number {
  return (ms - localDayRange(key, tz).from.getTime()) / 60000;
}

export function weekdayLong(key: string, tz = "UTC"): string {
  const { y, m, d } = parseDateKey(key);
  return new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: tz }).format(new Date(Date.UTC(y, m - 1, d, 12)));
}

export function formatDayLabel(key: string, style: "short" | "long" = "long"): string {
  const { y, m, d } = parseDateKey(key);
  return new Intl.DateTimeFormat("en-US", {
    weekday: style === "long" ? "long" : "short",
    month: style === "long" ? "long" : "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d, 12)));
}

export function guessTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Los_Angeles";
  } catch {
    return "America/Los_Angeles";
  }
}

export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
