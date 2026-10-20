import type { Metadata } from "next";
import { APP_NAME } from "@/lib/config";

export const metadata: Metadata = { title: "How it works" };

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="space-y-2">
    <h2 className="label text-sm text-accent">{title}</h2>
    <div className="space-y-2 leading-relaxed">{children}</div>
  </section>
);

export default function AboutPage() {
  return (
    <article className="mx-auto max-w-2xl space-y-10">
      <header>
        <p className="label text-sm text-accent">How it works</p>
        <h1 className="display text-4xl sm:text-5xl">{APP_NAME}, under the hood</h1>
        <p className="mt-3 text-muted">
          A planner for watching live sport: pick the games you care about, see how the day stacks up, and know exactly where each one is on
          where you live.
        </p>
      </header>

      <Section title="The schedule">
        <p>
          Fixtures and broadcast listings for 12 competitions (Premier League, LaLiga, Bundesliga, Serie A, Ligue 1, Champions League, MLS, NFL,
          college football, NBA, men&apos;s college basketball and NHL) are collected from ESPN&apos;s public scoreboards. The next week refreshes every
          three hours, the next two months nightly, and out to six months weekly.
        </p>
      </Section>

      <Section title="From channel to service">
        <p>
          A listing says &ldquo;USA Network&rdquo;; what you need to know is whether that&apos;s on your YouTube TV. Every channel is mapped to YouTube TV,
          Fubo, Hulu + Live TV, the streaming apps and free over-the-air TV, and every mapping cites the provider&apos;s own lineup or a published
          source. Where a source couldn&apos;t confirm a channel, it&apos;s marked &ldquo;check provider&rdquo; rather than guessed.
        </p>
      </Section>

      <Section title="Your area and local teams">
        <p>
          Regional sports networks, blackouts and over-the-air stations depend on where you are. {APP_NAME} estimates your location from your
          connection (or your zip code) and suggests teams within about 100 miles. You confirm or edit the list. Your local teams then decide which
          regional channels you see and which out-of-market packages are blacked out for you.
        </p>
      </Section>

      <Section title="What the labels mean">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Likely, not announced:</strong> channels are often confirmed only days before kickoff. Until then we show what that competition
            has used for most recent games.
          </li>
          <li>
            <strong>Regional, may not air in your area:</strong> NFL Sunday afternoon games on CBS and FOX are split by region, and the listing
            doesn&apos;t say which game your local station carries.
          </li>
          <li>
            <strong>Blacked out:</strong> out-of-market packages (NBA League Pass, NFL Sunday Ticket, ESPN+ for NHL) don&apos;t show your local
            team.
          </li>
          <li>
            <strong>End times:</strong> estimates from each sport&apos;s typical length. Live games that run long stretch on the timeline.
          </li>
        </ul>
      </Section>

      <Section title="Known limits">
        <p>
          Some local stations are marked &ldquo;check provider&rdquo; on streaming services. A few national-exclusive rules are measured from the data
          rather than published, so occasionally a local channel can show for a game that a national network carries exclusively.
        </p>
      </Section>

      <Section title="Privacy">
        <p>No account and no tracking of who you are. Your settings and plan stay in your browser. Shared plans are saved only when you share them.</p>
      </Section>
    </article>
  );
}
