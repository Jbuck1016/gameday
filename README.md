# Game Day

Plan what you're watching. Pick games across 12 leagues, mark each as must-watch or want-to-watch, and Game Day lays them out on a timeline with where each one airs in your area, which services you need, and how to split overlaps across a multiview.

## What it does

- **Browse** a day or week of games: Premier League, LaLiga, Bundesliga, Serie A, Ligue 1, Champions League, NBA, NFL, NHL, MLS, college football and men's college basketball.
- **Local to you.** Your area comes from your IP (or a zip code). Local teams are suggested and you confirm them, which decides regional networks and blackouts.
- **Where to watch**, per game: national channels, your regional networks, out-of-market packages, and likely channels when nothing is announced yet (always labeled).
- **Plan** view: timeline with estimated end times, overlap detection, the fewest services that cover your plan, and a multiview layout for overlapping windows.
- **Teams** view: up to six teams over the next six months, with same-day clashes flagged.
- **Share**: a link, a calendar file (.ics), or an image card in portrait, story or square.
- Three looks: Broadcast, Editorial, Terminal.
- **Best today**: a short, explained pick of the day's games with one-tap planning.
- **Team calendars**: subscribe once; games and channels update in your own calendar app.
- **Optional accounts** (Supabase Auth, Google or email link): settings and plans follow you between devices. Planning never requires one.

## Stack

Next.js 15 (App Router) + TypeScript, Tailwind v4, postgres.js against Supabase (`gameday` and `gameday_site` schemas), `next/og` for share cards. Listings are ingested every few hours by a Supabase edge function from ESPN's public scoreboard data and mapped to live TV services (YouTube TV, Fubo, Hulu + Live TV) and streaming apps.

## Running locally

```
npm install
npm run dev
```

With no database credentials the app runs on a bundled snapshot of the weekend of 24 October 2026 (`GAMEDAY_FIXTURES=1` forces this).

### Environment

| Variable | Purpose |
| --- | --- |
| `GAMEDAY_DB_USER` | Pooler login, `gameday_web.<project-ref>` |
| `GAMEDAY_DB_PASSWORD` | Password for that role |
| `GAMEDAY_DATABASE_URL` | Optional. Full connection string, overrides the two above |
| `IP_HASH_SALT` | Optional. Salt for rate-limit hashing |
| `GAMEDAY_FIXTURES` | `1` to use the snapshot instead of the database |
| `NEXT_PUBLIC_EMAIL_SIGNIN` | `1` to show email-link sign-in (needs custom SMTP in Supabase Auth) |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Optional overrides for sign-in; defaults point at the project |

The `gameday_web` role can read listings, write shared plans, zip lookups, usage events and calendar feeds, read and write signed-in users' saved settings, and call one account-deletion function. Nothing else, and nothing in Partner Ledger's tables.

## Tests

```
npm test        # unit: scheduling, overlaps, service cover, multiview, DST, contrast
npm run e2e     # Playwright against the snapshot
npm run typecheck
```

## Caveats

End times are estimates by sport. Premier League US channels are announced late, so most show as likely until about a week out. Regional network coverage depends on your provider; the app says so where it matters.
