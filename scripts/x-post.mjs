// Posts the day's slate to X, run by .github/workflows/x-post.yml on a schedule.
// 1. Asks the site what to post (/api/x/draft: kill switch, slot, checked games and copy lines).
// 2. Re-checks every game's kickoff against ESPN's own event API; a moved or started game is dropped.
// 3. Makes a shared plan of what's left, renders its image, and posts image + copy to X (OAuth 1.0a).
// Writes a JSON log line per post to $STORE/x-log/<day>.jsonl and the image to $STORE/x-posts/.
// Without all four X keys, or with DRY_RUN=1, it does everything except the post itself.

import { createHmac, randomBytes } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SITE = process.env.SITE ?? "https://gameday-tau-seven.vercel.app";
const STORE = process.env.STORE ?? "store";
const LOOK = process.env.LOOK || "departures";
const MIN_GAMES = 3;
const KEYS = {
  consumerKey: process.env.X_API_KEY,
  consumerSecret: process.env.X_API_SECRET,
  token: process.env.X_ACCESS_TOKEN,
  tokenSecret: process.env.X_ACCESS_SECRET,
};
const live = process.env.DRY_RUN !== "1" && Object.values(KEYS).every(Boolean);

const enc = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

/** OAuth 1.0a header. Multipart and JSON bodies are not part of the signature; there are no query params here. */
function oauthHeader(method, url) {
  const p = {
    oauth_consumer_key: KEYS.consumerKey,
    oauth_nonce: randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_token: KEYS.token,
    oauth_version: "1.0",
  };
  const params = Object.keys(p).sort().map((k) => `${enc(k)}=${enc(p[k])}`).join("&");
  const base = `${method}&${enc(url)}&${enc(params)}`;
  p.oauth_signature = createHmac("sha1", `${enc(KEYS.consumerSecret)}&${enc(KEYS.tokenSecret)}`).update(base).digest("base64");
  return "OAuth " + Object.keys(p).sort().map((k) => `${enc(k)}="${enc(p[k])}"`).join(", ");
}

async function xRequest(url, init) {
  const r = await fetch(url, { ...init, headers: { ...(init.headers ?? {}), authorization: oauthHeader(init.method, url) } });
  const body = await r.text();
  if (!r.ok) throw new Error(`${init.method} ${url} -> ${r.status} ${body.slice(0, 400)}`);
  return body ? JSON.parse(body) : {};
}

async function postToX(text, png) {
  const form = new FormData();
  form.append("media", new Blob([png], { type: "image/png" }), "slate.png");
  form.append("media_category", "tweet_image");
  const up = await xRequest("https://api.x.com/2/media/upload", { method: "POST", body: form });
  const mediaId = up?.data?.id;
  if (!mediaId) throw new Error(`media upload returned no id: ${JSON.stringify(up).slice(0, 300)}`);
  const post = await xRequest("https://api.x.com/2/tweets", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text, media: { media_ids: [mediaId] } }),
  });
  return post?.data?.id;
}

/** ESPN's current view of one event: kickoff and state. Throws when it can't be read. */
async function espnEvent(path, id) {
  const eventId = id.split(":").pop();
  const r = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${path}/summary?event=${eventId}`);
  if (!r.ok) throw new Error(`ESPN ${r.status}`);
  const j = await r.json();
  const comp = j?.header?.competitions?.[0];
  if (!comp?.date) throw new Error("ESPN gave no kickoff");
  return { start: Date.parse(comp.date), state: comp.status?.type?.state ?? null };
}

function log(day, entry) {
  mkdirSync(join(STORE, "x-log"), { recursive: true });
  appendFileSync(join(STORE, "x-log", `${day}.jsonl`), JSON.stringify({ at: new Date().toISOString(), live, ...entry }) + "\n");
  console.log(JSON.stringify(entry));
}

function alreadyPosted(day, kind, group) {
  const f = join(STORE, "x-log", `${day}.jsonl`);
  if (!existsSync(f)) return false;
  return readFileSync(f, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l))
    .some((e) => e.status === "posted" && e.slot === kind && e.group === group);
}

async function main() {
  const q = new URLSearchParams();
  if (process.env.SLOT_DAY) q.set("day", process.env.SLOT_DAY);
  if (process.env.SLOT_KIND) q.set("slot", process.env.SLOT_KIND);
  const draftRes = await fetch(`${SITE}/api/x/draft${q.size ? `?${q}` : ""}`);
  if (!draftRes.ok) throw new Error(`draft ${draftRes.status} ${await draftRes.text()}`);
  const draft = await draftRes.json();
  const { day, kind } = draft.slot;
  // a dry run goes ahead with the kill switch off, so the whole pipeline can be checked before posting is on
  if (!draft.enabled && live) return log(day, { slot: kind, status: "disabled" });
  if (draft.dropped.length) log(day, { slot: kind, status: "dropped", dropped: draft.dropped });
  if (!draft.posts.length) return log(day, { slot: kind, status: "nothing", skipped: draft.skipped });

  let failures = 0;
  for (const post of draft.posts) {
    const base = { slot: kind, group: post.group };
    try {
      if (alreadyPosted(day, kind, post.group)) { log(day, { ...base, status: "duplicate" }); continue; }
      const kept = [];
      const moved = [];
      for (const g of post.games) {
        try {
          const e = await espnEvent(g.path, g.id);
          if (Math.abs(e.start - Date.parse(g.start)) > 60_000) moved.push({ id: g.id, reason: `kickoff moved to ${new Date(e.start).toISOString()}` });
          else if (e.state !== "pre") moved.push({ id: g.id, reason: `state ${e.state}` });
          else kept.push(g);
        } catch (err) {
          moved.push({ id: g.id, reason: `ESPN check failed: ${err.message}` });
        }
      }
      if (kept.length < MIN_GAMES) { log(day, { ...base, status: "skipped", reason: `only ${kept.length} games passed the ESPN check`, moved }); continue; }
      const text = `${post.title}\n\n${kept.map((g) => g.line).join("\n")}`;

      const planRes = await fetch(`${SITE}/api/plans`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: post.title.replace(/ \(ET\)$/, ""),
          dateFrom: day, dateTo: day, timezone: "America/New_York", theme: "daylight",
          areaLabel: "National TV · times ET", localTeamIds: [], services: [], spanish: false,
          items: kept.map((g) => ({ eventId: g.id, priority: "want" })),
        }),
      });
      if (!planRes.ok) throw new Error(`plan ${planRes.status} ${await planRes.text()}`);
      const { slug } = await planRes.json();
      const img = await fetch(`${SITE}/api/og/x?plan=${slug}&kind=slate&look=${LOOK}&link=0`);
      if (!img.ok) throw new Error(`image ${img.status}`);
      const png = Buffer.from(await img.arrayBuffer());
      mkdirSync(join(STORE, "x-posts"), { recursive: true });
      writeFileSync(join(STORE, "x-posts", `${day}-${kind}-${post.group}.png`), png);

      const games = kept.map((g) => ({ id: g.id, start: g.start, outlet: g.outlet, line: g.line }));
      if (!live) { log(day, { ...base, status: "dry_run", plan: slug, text, games, moved }); continue; }
      const tweetId = await postToX(text, png);
      log(day, { ...base, status: "posted", tweet: tweetId, plan: slug, text, games, moved });
    } catch (err) {
      failures++;
      log(day, { ...base, status: "error", error: String(err.message ?? err) });
    }
  }
  if (failures) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
