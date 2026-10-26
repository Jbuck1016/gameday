import type { Metadata } from "next";
import Link from "next/link";
import { APP_NAME } from "@/lib/config";

export const metadata: Metadata = { title: "Privacy" };

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="space-y-2">
    <h2 className="label text-sm text-accent">{title}</h2>
    <div className="space-y-2 leading-relaxed">{children}</div>
  </section>
);

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-2xl space-y-8">
      <header>
        <p className="label text-sm text-accent">Privacy</p>
        <h1 className="display text-4xl sm:text-5xl">Privacy policy</h1>
        <p className="mt-2 text-sm text-muted">Last updated 25 October 2026.</p>
      </header>

      <Section title="What this covers">
        <p>
          {APP_NAME} is a free planner for watching live sport. This page explains what it stores, why, and how to remove it. You can use every
          part of {APP_NAME} without an account.
        </p>
      </Section>

      <Section title="Without an account">
        <p>Your area, teams, services, theme and plan are kept in your own browser. We don&apos;t receive them unless you share a plan or create a calendar link.</p>
        <p>
          Your approximate location (city level) is looked up from your connection or a zip code you enter, only to choose local teams and
          channels. We don&apos;t store your IP address.
        </p>
      </Section>

      <Section title="If you sign in with Google or an email link">
        <p>
          We receive your email address and Google&apos;s account ID for you. We use them only to sign you in and to save your settings and plans to
          your account so they appear on your other devices. We don&apos;t read anything else from your Google account, and we never send you
          marketing email.
        </p>
        <p>Your account data is stored with Supabase (our database and sign-in provider) and the site is hosted on Vercel.</p>
      </Section>

      <Section title="Usage counts">
        <p>
          To learn whether the site is useful, it records actions such as visiting, adding a game or exporting a card, tied to a random ID stored in
          your browser (and to your account if you sign in). These counts are never sold or shared, and aren&apos;t used for advertising.
        </p>
      </Section>

      <Section title="Shared plans and calendars">
        <p>
          When you share a plan or create a calendar link, we save the games, your area name, services and theme so the link works. Anyone with the
          link can see it. They hold no email or account details.
        </p>
      </Section>

      <Section title="Deleting your data">
        <p>
          Signed in: go to <Link href="/settings#account" className="link">Settings</Link> and choose Delete account. That removes your email, saved
          settings and plans. Without an account: clear this site&apos;s data in your browser.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Questions or removal requests: <a className="link" href="mailto:jackbuckiingham@gmail.com">jackbuckiingham@gmail.com</a>.
        </p>
      </Section>
    </article>
  );
}
