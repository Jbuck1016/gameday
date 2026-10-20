# Game Day: Claude Code Build Brief (v2)

Working name: **Game Day**. Keep it in one config constant (`APP_NAME`) so it can change before launch.

This brief covers the **site only**. The data pipeline is already built and running (section 4). Do not rebuild ingestion, schedules or channel mapping; read from what exists.

## 1. What we're building

A web app that turns "the games I want to watch" into a plan for the visitor's own area: when each game is on, how long it runs, what channel it's on, and which of their services carries it.

A visitor:

1. **Sets their area.** Auto-detected from their IP, or they type a zip code. The app suggests their local teams; they confirm or edit the list.
2. **Picks games** for a day or a week, marking each **Must watch** or **Want to watch**. Or picks up to 6 teams over a date range to see all their games and the days they clash.
3. **Gets a plan:**
   - a **timeline** with estimated game lengths, so overlaps are obvious
   - **where each game is on** for their area: channel, which services carry it, blackouts, local channels for their teams
   - a **multiview planner**: windows where 2 to 4 games run at once, and whether one service covers them all
   - a **day card** exported as a PNG in one of three themes, a share link, and a calendar file

Leagues (v1): Premier League, LaLiga, Bundesliga, Serie A, Ligue 1, Champions League, MLS, NFL, college football (FBS), NBA, men's college basketball, NHL.

Access: public, no accounts in v1. Preferences and the working plan live in the browser; shared plans live in the database by link.

## 2. Decisions already made (don't revisit)

| Decision | Detail |
|---|---|
| Tailored to the visitor's area | Location from IP or zip; local teams suggested by distance, then confirmed by the visitor. No paid market data. |
| Services covered | YouTube TV, Fubo, Hulu + Live TV, plus streaming apps (Peacock, Paramount+, ESPN+/ESPN Unlimited, Apple TV, Prime Video, DAZN, team apps, League Pass, Sunday Ticket) and free over-the-air. |
| No channel announced yet | Show the league's likely channels, labeled "likely, not announced". Flip to confirmed when the data updates. |
| Spanish-language channels | Hidden by default, toggle to show. Always shown when they're the only way to watch. |
| Themes | Three, user-selectable: Broadcast (default), Editorial, Terminal. Skins over one layout (section 8). |
| Tennis | Out of v1. |

## 3. Out of scope for v1

- Streaming games or deep-linking into provider apps
- Predicting YouTube TV multiview eligibility
- Which NFL Sunday CBS/Fox regional game airs in a given area (shown as "regional, may not air in your area")
- Push notifications, scores beyond live status, odds, stats
- Native apps

## 4. The data you're reading (already live)

Supabase project **The Partner Ledger** (`soknxaqllvdpshezjbnw`), schema **`gameday`** only. Never read or write any other schema in this project; another product lives there.

The schema is **not exposed** to the Supabase REST API. The site reads it **server-side only**, over a Postgres connection as the login role **`gameday_web`** (section 5). Nothing in `gameday` is reachable from the browser.

`gameday_web` can only: read `gameday.events/teams/leagues/services`, execute the two functions below plus `gameday_site.suggest_local_teams_for_zip`, read/write `gameday_site.plans` and `plan_items`, and insert/read `gameday_site.zip_centroids`. It cannot create tables or touch any other schema. If something needs more access, stop and say so; do not look for admin credentials.

Refresh (already scheduled, do not touch): next 7 days every 3 hours; next 60 days nightly; out to 180 days weekly.

### Functions to call

**`gameday.suggest_local_teams(lat, lon, radius_km default 160)`**
Returns `team_id, league_id, team_name, city, distance_km`, nearest first. Verified: downtown LA returns Lakers, Kings, LAFC, Rams, Chargers, Clippers, Galaxy, Ducks; Boston returns Bruins, Celtics, Revolution, Patriots.

**`gameday.watch_options(p_from, p_to, p_local_teams text[], p_spanish bool, p_leagues text[] default null)`**
The single source for "how do I watch this". One row per game x option x service:

| Column | Meaning |
|---|---|
| `event_id, league_id, start_utc, time_valid, event_name, home_team, away_team` | The game. `time_valid = false` means the kickoff is a placeholder: show "Time TBC". |
| `involves_local_team` | One of the visitor's confirmed teams is playing |
| `basis` | `national`, `local_team`, `out_of_market` (League Pass, Sunday Ticket), `likely` |
| `outlet` | What to tune to (ESPN, NBC Sports Boston, Peacock...) |
| `service_id, service` | Where that outlet is available |
| `status` | `included`, `addon` (see `addon_name`), `not_available`, `unverified`, `direct` (the outlet is itself the service, e.g. a team app) |
| `confidence` | `confirmed`, `likely`, `regional`, `blacked_out` |
| `note` | Human-readable caveat to show as-is |

Rules already inside the function: national exclusives pre-empt local broadcasts; out-of-market packages are marked blacked out for local teams; NBA games on NBC also list Peacock; unannounced games get likely channels only for leagues where those channels cover at least 60% of recent games.

### Tables to read directly

- `gameday.events`: browse lists (`id, league_id, start_utc, time_valid, status_state, home_team_id, away_team_id, name, venue, home_rank, away_rank`)
- `gameday.teams`: `id, league_id, name, short_name, abbreviation, color, alt_color, logo_url`
- `gameday.leagues`: `id, name, short_name, default_duration_min` (timeline estimates)
- `gameday.services`: names for the "services I have" picker

Do not write to any `gameday` table except the user tables you create in section 11.

## 5. Stack

- Next.js (App Router) + TypeScript on Vercel
- Server-side Postgres via `postgres` (porsager), `prepare: false`, using the **transaction pooler** connection string in env `GAMEDAY_DATABASE_URL`. All queries live in `lib/db/` and run only in server components, route handlers or server actions.
  - `.env.local` arrives with `GAMEDAY_DB_USER` and `GAMEDAY_DB_PASSWORD` only. Build the URL as `postgresql://gameday_web.soknxaqllvdpshezjbnw:<password>@<host>:6543/postgres`. The host is either `aws-0-us-west-2.pooler.supabase.com` or `aws-1-us-west-2.pooler.supabase.com`: try both, keep the one that connects, and write the full `GAMEDAY_DATABASE_URL` into `.env.local`.
- Location: `geolocation()` from `@vercel/functions` (returns city, latitude, longitude). Not available in local dev; fall back to zip entry.
- Zip to coordinates: US Census Gazetteer ZCTA file (public domain), loaded once into a `gameday_site.zip_centroids` table (section 11).
- Tailwind, driven by theme tokens
- `next/og` `ImageResponse` for PNG day cards
- `ics` for calendar files
- `zod` at every boundary (query params, form input, DB rows)
- `vitest` unit tests, Playwright smoke tests
- Vercel Analytics custom events

## 6. Screens

All screens work at 390 px and desktop.

1. **Set your area** (first visit, and from the header anytime): detected city shown with "Not right? Enter zip". Below it, suggested local teams as removable chips, plus "Add a team" search. Save to localStorage (and account if signed in).
2. **Browse** (`/`): day picker with week toggle, league chips, team search. Games grouped by local start time. Each row: teams with logos and colors, competition, the best way to watch *for this visitor* (first `confirmed` option on a service they have, else the first confirmed option), and **Must** / **Want** buttons. Sticky bar: plan count, "View plan".
3. **Plan** (`/plan`, shared read-only at `/p/[slug]`): header, timeline (7:00 to 23:00 local, auto-extends), overlap callouts, game rows (time, estimated end, matchup, outlet, services, priority, notes like "Blacked out for your local team"), services needed, multiview windows. Actions: theme switcher, Export image, Copy link, Add to calendar, change priority, remove.
4. **Week**: seven compact timelines; tap a day to open it.
5. **Teams** (`/teams`): up to 6 teams, range up to 180 days. Chronological list with **Same day only** and **Clashes only** toggles. Send any day to a plan in one tap.
6. **Multiview**: windows from section 9, with a 2x2 mock grid per window (musts top-left first).
7. **Settings**: area and local teams, services I have, Spanish toggle, default theme.
8. **How it works** (`/about`): data source, refresh cadence, estimated durations, what "likely" and "regional" mean, how local teams are chosen. Doubles as the portfolio case-study page.

### Showing options

- Group by outlet, then list services. Mark services the visitor has.
- `confidence = likely`: dashed style, label "Likely, not announced".
- `confidence = regional`: label "Regional, may not air in your area".
- `confidence = blacked_out`: strike-through with the note.
- `status = unverified`: show with "check provider".
- No options at all: "Channel TBA".

## 7. Core logic (pure functions, tests first)

`lib/schedule/duration.ts`: estimated end = start + `leagues.default_duration_min`; label "estimated". If live status is still `in` past the estimate, extend to now + 15 min and mark "running long".

`lib/schedule/overlap.ts`: sweep line over start/end → segments with active games; overlaps = segments with 2+ games; peak screens.

`lib/schedule/multiview.ts`: windows with 2 to 4 concurrent games; verdict `single_service` (one service the visitor has covers all), `split`, or `over_four` (suggest dropping lowest-priority wants). Suggest up to 3 fill games already in `watch_options` for the window, on a service the visitor has.

`lib/schedule/services.ts`: minimal set of services covering all must-watch games, then wants (greedy set cover). Flag must-watch games none of the visitor's services cover.

`lib/time.ts`: UTC everywhere; local day boundaries via `Intl` in the visitor's timezone.

## 8. Themes

Three skins over one layout. Mockups: canvas "Game Day Planner Directions".

| Token | broadcast | editorial | terminal |
|---|---|---|---|
| ground | `#0B1220` | `#FFFFFF` | `#0A0A0A` |
| surface | `#131C2E` | `#FFFFFF` (rules, not panels) | `#0A0A0A` (1px `#2A2A2A` borders) |
| text | `#F5F7FA` | `#111111` | `#D9D9D9` |
| muted | `#9AA6B8` | `#5A5A5A` | `#8C8C8C` |
| accent | `#F2C94C` | `#B3121F` | `#FFB000` |
| display font | Anton | Newsreader | JetBrains Mono 800 |
| label font | Barlow Condensed 600/700 | Public Sans 600 | JetBrains Mono 500 |
| body font | Barlow | Public Sans | JetBrains Mono |
| must-watch mark | solid bar, team color | solid ink bar | solid accent bar |
| want-to-watch mark | team-color outline | hatched outline | blue outline + tint |
| time format | `7:30A` | `7:30am` | `07:30` |

- `lib/themes/*.ts` export a `Theme` (tokens, fonts, formatters, component variants). Shared components never branch on theme name.
- The PNG renderer uses the same theme objects.
- Theme choice: `?theme=` > account > localStorage > `broadcast`.
- Fonts from Google Fonts via `next/font/google`; same files loaded as ArrayBuffers for `ImageResponse`.
- Contrast: 4.5:1 for text (3:1 at 24px+). Must vs want distinguishable without color. `ensureContrast(teamHex, groundHex)` adjusts team colors to 3:1.

## 9. Export, share, calendar

- `GET /api/card?plan={slug}&theme=&size=portrait|story|square` → PNG via `ImageResponse` (1080x1350 default, 1080x1920, 1080x1080). Flexbox only (no CSS grid). If a repeating gradient doesn't render, fall back to an outline.
- Exporting an unsaved plan first creates an anonymous shared plan so the image has a stable URL.
- `/p/[slug]` sets the card as its Open Graph image.
- `GET /api/ics?plan={slug}`: one event per game; location = outlet + service; description notes the estimated end.

## 10. Live status

`/api/live?date=` returns `{eventId, state}` for games in the plan, read from `gameday.events` (refreshed every 3 hours) plus a direct fetch of that day's ESPN scoreboard for the plan's leagues, cached 60 s. Poll every 60 s only when a plan game is live or starts within 30 minutes.

## 11. Site-owned data

The site's **own schema, `gameday_site`, already exists**. Do not create or alter tables; `gameday_web` can't, by design.

```sql
-- already created
gameday_site.zip_centroids (zip text pk, lat, lon)            -- EMPTY: load it in Phase 1
gameday_site.plans (
  id uuid pk default gen_random_uuid(), owner_id uuid, share_slug text unique not null, title text,
  date_from date, date_to date, timezone text,
  theme text check in ('broadcast','editorial','terminal') default 'broadcast',
  local_team_ids text[], services text[], spanish boolean default false,
  creator_ip_hash text, created_at, updated_at)
gameday_site.plan_items (plan_id uuid fk on delete cascade, event_id text, priority text check in ('must','want'), pk (plan_id, event_id))
gameday_site.suggest_local_teams_for_zip(zip text, radius_km default 160)   -- same output as gameday.suggest_local_teams
```

**Zip load (Phase 1):** a one-off script `scripts/load-zips.ts` downloads the latest US Census Gazetteer ZCTA national file (find it from https://www.census.gov/data/data-tools/gazetteer.html), parses GEOID, INTPTLAT, INTPTLONG, and batch-inserts into `gameday_site.zip_centroids` (about 33,000 rows). Re-runnable: skip zips already present.

Rate-limit anonymous plan creation: store a salted SHA-256 of the IP in `creator_ip_hash`; max 20 plans per hash per hour.

**No accounts in v1** (decided): this project's sign-in system is shared with another product. Game Day moves to its own Supabase project before accounts are added. Until then: localStorage for preferences and the working plan, shared plans by slug. Remove the "Settings (signed in)" idea; Settings is a local-only screen.

## 12. Analytics

Vercel Analytics events: `area_set` (method: ip|zip), `local_teams_edited`, `plan_item_added` (priority, league), `card_exported` (theme, size), `share_link_copied`, `ics_downloaded`, `teams_view_run` (team count, range days), `theme_changed`. No personal data in props.

## 13. Build phases

Run all phases in one session. Pause only for things Jack must do himself: logging in to GitHub or Vercel in the browser when a CLI asks.

**Phase 0: Scaffold, connect, read check.** Next.js + TS + Tailwind + vitest + Playwright, git init, `.env*.local` in `.gitignore` (check it before the first commit). Build `GAMEDAY_DATABASE_URL` as described in section 5. `lib/db` smoke test: `suggest_local_teams` for downtown LA (34.0522, -118.2437) returns the Lakers and Kings; `watch_options` for the next 24 hours returns rows. Create a private GitHub repo `gameday` with `gh` and push. Link a Vercel project with `npx vercel link`, add `GAMEDAY_DATABASE_URL` to Production and Preview with `npx vercel env add`, deploy a placeholder page, confirm it loads.

**Phase 1: Area.** Zip load (section 11), `/api/area` (IP via `geolocation()`, or zip via `suggest_local_teams_for_zip`), area screen with local team chips.

**Phase 2: Browse and plan builder.** Browse with best-option-for-you, Must/Want, localStorage plan, Plan screen list view.

**Phase 3: Timeline, overlaps, week view, themes.** Pure functions with tests first; three themes and the switcher.

**Phase 4: Export, share, calendar.** Card in 3 themes x 3 sizes, slugs, OG image, `.ics`.

**Phase 5: Teams view and multiview.**

**Phase 6: Live status, settings, about, analytics, polish.**

## 14. External checks (don't self-grade)

- **Unit tests:** overlaps (identical starts, nesting, touching edges), multiview verdicts, set cover, DST boundary (first Sunday of November), a day mixing UK and US kickoffs.
- **Against the raw source:** for 10 games in 3 different visitor areas, compare the plan screen with Sports Media Watch's team schedule pages. Already passed at the database level for 8 Lakers and Celtics games (times, channels, exclusives, local coverage); re-run through the UI.
- **Visual:** Playwright golden images of `/api/card` for a fixed plan in each theme and size.
- **Contrast:** test every token pair and `ensureContrast` on 50 team colors.
- **Usability (Jack runs it):** five people outside the build, "plan your Saturday and send it to a friend". Target: under 2 minutes to an exported image.

## 15. Known data limits (show honestly in the UI and on /about)

- Premier League channels are announced late; "likely" covers the gap.
- NFL Sunday regional CBS/Fox games can't be resolved by area.
- Some local channel carriage is `unverified` (mostly free over-the-air stations on YouTube TV and Hulu).
- National exclusivity rules are measured for NHL and observed for NBA ESPN, NBC and Prime Video; other combinations default to showing the local channel too.

## 16. Definition of done

- A first-time visitor anywhere in the US gets correct local teams (or fixes them in one step) and exports a day card in under 2 minutes, without an account.
- `watch_options` results render faithfully: every confidence level and note is visible.
- Share links preview the card in iMessage and Slack.
- Teams view handles 6 teams over 180 days in under 1 second.
- All checks in section 14 pass and their results are committed.
