"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePrefs } from "@/lib/prefs";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { EMAIL_SIGNIN } from "@/lib/supabase/config";
import { track } from "@/lib/track";

const ERRORS: Record<string, string> = {
  expired: "That sign-in link has expired or was already used. Try again.",
  missing: "Sign-in didn't finish. Try again.",
};

function safeNext(): string {
  const n = new URLSearchParams(window.location.search).get("next") ?? "/";
  return n.startsWith("/") && !n.startsWith("//") ? n : "/";
}

export function SignIn() {
  const { account } = usePrefs();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<"google" | "email" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const e = new URLSearchParams(window.location.search).get("error");
    if (e) setMsg(ERRORS[e] ?? ERRORS.missing);
  }, []);

  const callback = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeNext())}`;

  const google = async () => {
    setBusy("google");
    setMsg(null);
    track("sign_in_started", { method: "google" });
    const { error } = await supabaseBrowser().auth.signInWithOAuth({ provider: "google", options: { redirectTo: callback() } });
    if (error) {
      setMsg("Google sign-in isn't available right now. Try again in a minute.");
      setBusy(null);
    }
  };

  const sendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setMsg("That doesn't look like an email address.");
      return;
    }
    setBusy("email");
    setMsg(null);
    track("sign_in_started", { method: "email" });
    const { error } = await supabaseBrowser().auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: callback() } });
    setBusy(null);
    if (error) setMsg("Couldn't send the link. Wait a minute and try again.");
    else setSent(true);
  };

  if (account) {
    return (
      <div className="panel mx-auto max-w-md p-6 text-center">
        <h1 className="display text-3xl">You&apos;re signed in</h1>
        <p className="mt-2 text-sm text-muted">{account.email}</p>
        <Link href="/" className="btn btn-primary mt-6 no-underline">
          Back to games
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <header>
        <p className="label text-sm text-accent">Account</p>
        <h1 className="display text-4xl">Keep your plan everywhere</h1>
        <p className="mt-2 text-muted">
          Sign in to save your area, teams, services and plans to your account, so they&apos;re on your phone and your laptop. You never need an
          account to plan.
        </p>
      </header>

      <div className="panel space-y-4 p-4">
        <button type="button" className="btn btn-primary w-full" onClick={google} disabled={!!busy}>
          {busy === "google" ? "Opening Google…" : "Continue with Google"}
        </button>

        {EMAIL_SIGNIN &&
          (sent ? (
            <p className="text-sm" role="status">
              Check your inbox for a sign-in link from Game Day. It works once and expires after an hour.
            </p>
          ) : (
            <form onSubmit={sendLink} className="space-y-2">
              <label htmlFor="email" className="label block text-sm text-muted">
                Or get a sign-in link by email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                className="input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <button type="submit" className="btn w-full" disabled={!!busy}>
                {busy === "email" ? "Sending…" : "Email me a link"}
              </button>
            </form>
          ))}

        {msg && (
          <p className="text-sm" role="alert">
            {msg}
          </p>
        )}
      </div>

      <p className="text-xs text-muted">
        We store your email and the settings and plans you save. Nothing is shared or sold, and you can delete your account in Settings.{" "}
        <Link href="/privacy" className="link">
          Privacy policy
        </Link>
      </p>
    </div>
  );
}
