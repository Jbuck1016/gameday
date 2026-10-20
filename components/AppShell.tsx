"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { usePrefs } from "@/lib/prefs";
import { THEMES, THEME_IDS } from "@/lib/themes";
import { APP_NAME } from "@/lib/config";

const NAV = [
  { href: "/", label: "Browse" },
  { href: "/plan", label: "Plan" },
  { href: "/teams", label: "Teams" },
  { href: "/settings", label: "Settings" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { prefs, theme, setTheme, ready, meta } = usePrefs();
  const count = prefs.plan.length;
  const shared = path.startsWith("/p/");

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/" className="display text-2xl tracking-tight text-ink no-underline">
            {APP_NAME}
          </Link>
          {!shared && (
            <nav aria-label="Main" className="flex flex-wrap items-center gap-1">
              {NAV.map((n) => {
                const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    aria-current={active ? "page" : undefined}
                    className={`label flex min-h-11 items-center px-3 text-sm no-underline ${active ? "text-accent" : "text-muted hover:text-ink"}`}
                  >
                    {n.label}
                    {n.href === "/plan" && ready && count > 0 && (
                      <span className="ml-1.5 inline-flex min-w-5 items-center justify-center bg-accent px-1 text-xs text-accent-ink">
                        {count}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          )}
          <div className="ml-auto flex items-center gap-3">
            {!shared && prefs.area && (
              <Link href="/area" className="link max-w-40 truncate whitespace-nowrap text-sm" title="Change your area">
                {prefs.area.label}
              </Link>
            )}
            <label className="sr-only" htmlFor="theme-select">
              Theme
            </label>
            <select
              id="theme-select"
              className="input min-h-9 w-auto py-1 text-sm"
              value={theme}
              onChange={(e) => setTheme(e.target.value as typeof theme)}
            >
              {THEME_IDS.map((t) => (
                <option key={t} value={t}>
                  {THEMES[t].label}
                </option>
              ))}
            </select>
          </div>
        </div>
        {meta?.fixtureMode && (
          <p className="bg-surface2 px-4 py-1 text-center text-xs text-muted">
            Demo data: a snapshot of the weekend of 24 October 2026.
          </p>
        )}
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-5xl flex-wrap justify-between gap-2 px-4 py-4 text-xs text-muted">
          <span>Listings refresh every few hours. End times are estimates.</span>
          <Link href="/about" className="link">
            How it works
          </Link>
        </div>
      </footer>
    </div>
  );
}
