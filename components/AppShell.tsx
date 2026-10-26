"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { usePrefs } from "@/lib/prefs";
import { APP_NAME } from "@/lib/config";

const NAV = [
  { href: "/", label: "Today" },
  { href: "/plan", label: "Plan" },
  { href: "/teams", label: "Teams" },
];

function PinIcon() {
  return (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 22s7-7 7-12a7 7 0 0 0-14 0c0 5 7 12 7 12z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { prefs, ready, meta, account } = usePrefs();
  const count = prefs.plan.length;
  const shared = path.startsWith("/p/");
  const areaShort = prefs.area?.label.split(",")[0] ?? "Set area";

  return (
    <div className="flex min-h-dvh flex-col">
      <header>
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-2 gap-y-1 px-4 pt-4 pb-1">
          <Link href="/" className="display shrink-0 text-xl no-underline">
            {APP_NAME}
          </Link>
          {!shared && (
            <nav aria-label="Main" className="order-last -ml-3 flex basis-full items-center gap-0.5 sm:order-none sm:ml-2 sm:basis-auto">
              {NAV.map((n) => {
                const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-11 items-center rounded-full px-3 text-sm font-semibold no-underline ${active ? "text-ink" : "text-muted hover:text-ink"}`}
                  >
                    {n.label}
                    {n.href === "/plan" && ready && count > 0 ? (
                      <span className="ml-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-ink px-1.5 text-xs text-ground">{count}</span>
                    ) : null}
                  </Link>
                );
              })}
            </nav>
          )}
          <div className="ml-auto flex items-center gap-2">
            {!shared && (
              <Link href="/area" className="btn min-h-9 max-w-36 gap-1.5 px-3 text-xs no-underline" title={prefs.area?.label ?? "Set your area"}>
                <PinIcon />
                <span className="truncate">{ready ? areaShort : " "}</span>
              </Link>
            )}
            {!shared && account !== undefined && (
              <Link
                href={account ? "/settings" : `/signin?next=${encodeURIComponent(path)}`}
                aria-label={account ? "Account and settings" : "Sign in"}
                className={`btn h-9 min-h-9 w-9 p-0 no-underline ${account ? "btn-primary" : ""}`}
              >
                <PersonIcon />
              </Link>
            )}
          </div>
        </div>
        {meta?.fixtureMode && <p className="bg-surface2 px-4 py-1 text-center text-xs text-muted">Demo data: a snapshot of the weekend of 24 October 2026.</p>}
      </header>
      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 py-3">
        {children}
      </main>
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-3xl flex-wrap justify-between gap-2 px-4 py-4 text-xs text-muted">
          <span>Listings refresh every few hours. End times are estimates.</span>
          <span className="flex gap-4">
            <Link href="/about" className="link">
              How it works
            </Link>
            <Link href="/privacy" className="link">
              Privacy
            </Link>
            <Link href="/settings" className="link">
              Settings
            </Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
