// First-party usage events, so we can measure first-session planning and return visits without accounts.
// A random visitor id lives in localStorage and a session id in sessionStorage; nothing personal is sent.
// Events also go to Vercel Analytics for its dashboard.

import { track as vercelTrack } from "@vercel/analytics";

type Props = Record<string, string | number | boolean | null>;
type Queued = { n: string; path: string; p: Props };

const VKEY = "gameday:vid";
const SKEY = "gameday:sid";
const IKEY = "gameday:internal";
const FIRST_KEY = "gameday:first";

let memVisitor: string | null = null;
let memSession: string | null = null;
let queue: Queued[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let listening = false;

function rid(n = 16): string {
  const a = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(n);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => a[b % a.length]).join("");
}

function stored(storage: () => Storage, key: string, fallback: () => string): string {
  try {
    const s = storage();
    const v = s.getItem(key);
    if (v && /^[A-Za-z0-9]{8,32}$/.test(v)) return v;
    const nv = fallback();
    s.setItem(key, nv);
    return nv;
  } catch {
    return fallback();
  }
}

function ids(): { v: string; s: string } {
  memVisitor ??= stored(() => window.localStorage, VKEY, () => rid());
  memSession ??= stored(() => window.sessionStorage, SKEY, () => rid());
  return { v: memVisitor, s: memSession };
}

function isInternal(): boolean {
  try {
    return window.localStorage.getItem(IKEY) === "1";
  } catch {
    return false;
  }
}

function flush() {
  if (timer) clearTimeout(timer);
  timer = null;
  if (!queue.length || typeof window === "undefined") return;
  const { v, s } = ids();
  const events = queue.splice(0, 25);
  const body = JSON.stringify({ v, s, i: isInternal(), events });
  try {
    const ok = navigator.sendBeacon?.("/api/track", new Blob([body], { type: "application/json" }));
    if (!ok) void fetch("/api/track", { method: "POST", body, headers: { "content-type": "application/json" }, keepalive: true }).catch(() => {});
  } catch {
    // tracking must never break the page
  }
  if (queue.length) flush();
}

export function track(name: string, props: Props = {}) {
  if (typeof window === "undefined") return;
  try {
    vercelTrack(name, props);
  } catch {
    // ignore
  }
  queue.push({ n: name, path: window.location.pathname.slice(0, 200), p: props });
  if (!listening) {
    listening = true;
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && flush());
  }
  if (!timer) timer = setTimeout(flush, 1200);
}

function refHost(): string | null {
  try {
    if (!document.referrer) return null;
    const h = new URL(document.referrer).hostname;
    return h === window.location.hostname ? null : h.replace(/^www\./, "").slice(0, 80);
  } catch {
    return null;
  }
}

/** Call once per page load: handles ?internal=1 / ?internal=0 and logs one visit per session. */
export function initTracking() {
  if (typeof window === "undefined") return;
  const q = new URLSearchParams(window.location.search);
  try {
    if (q.get("internal") === "1") window.localStorage.setItem(IKEY, "1");
    if (q.get("internal") === "0") window.localStorage.removeItem(IKEY);
  } catch {
    // ignore
  }
  let firstSession = true;
  let visitLogged = false;
  try {
    visitLogged = window.sessionStorage.getItem("gameday:visit") === "1";
    window.sessionStorage.setItem("gameday:visit", "1");
    const first = window.localStorage.getItem(FIRST_KEY);
    if (first) firstSession = false;
    else window.localStorage.setItem(FIRST_KEY, new Date().toISOString().slice(0, 10));
  } catch {
    // storage blocked: still log the visit once for this page load
  }
  if (visitLogged) return;
  track("visit", {
    ref: refHost(),
    utm: q.get("utm_source")?.slice(0, 60) ?? null,
    campaign: q.get("utm_campaign")?.slice(0, 60) ?? null,
    returning: !firstSession,
    mobile: window.matchMedia?.("(max-width: 640px)").matches ?? false,
  });
}

/** The anonymous visitor id (for linking a calendar subscription to the visitor who made it). */
export function visitorId(): string | null {
  if (typeof window === "undefined") return null;
  return ids().v;
}
