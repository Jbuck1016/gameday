"use client";

import Link from "next/link";
import { useState } from "react";
import { usePrefs } from "@/lib/prefs";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { track } from "@/lib/track";

export function AccountSection() {
  const { account, sync, signedOut } = usePrefs();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (account === undefined) return null;

  if (!account) {
    return (
      <section aria-labelledby="acct-h" className="panel p-4" id="account">
        <h2 id="acct-h" className="label text-sm text-muted">
          Account
        </h2>
        <p className="mt-2 text-sm">Settings and plans are saved in this browser. Sign in to have them on every device.</p>
        <Link href="/signin?next=/settings" className="btn btn-primary mt-3 no-underline">
          Sign in
        </Link>
      </section>
    );
  }

  const signOut = async () => {
    setBusy(true);
    await supabaseBrowser().auth.signOut().catch(() => {});
    track("signed_out");
    signedOut();
    setBusy(false);
  };

  const remove = async () => {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/me", { method: "DELETE" }).catch(() => null);
    if (!res || !res.ok) {
      setMsg("Couldn't delete the account. Try again.");
      setBusy(false);
      return;
    }
    track("account_deleted");
    await supabaseBrowser().auth.signOut().catch(() => {});
    signedOut();
    setBusy(false);
    setMsg("Account deleted. What's in this browser stays until you clear it.");
  };

  return (
    <section aria-labelledby="acct-h" className="panel space-y-3 p-4" id="account">
      <h2 id="acct-h" className="label text-sm text-muted">
        Account
      </h2>
      <p className="text-sm">
        Signed in as <span className="font-semibold">{account.email ?? "your account"}</span>.{" "}
        <span className="text-muted">
          {sync === "saving" ? "Saving…" : sync === "error" ? "Couldn't save the last change; it'll retry on your next edit." : "Changes save to your account."}
        </span>
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn" onClick={signOut} disabled={busy}>
          Sign out
        </button>
        {!confirming ? (
          <button type="button" className="btn" onClick={() => setConfirming(true)} disabled={busy}>
            Delete account
          </button>
        ) : (
          <>
            <button type="button" className="btn btn-primary" onClick={remove} disabled={busy}>
              Yes, delete it
            </button>
            <button type="button" className="btn" onClick={() => setConfirming(false)} disabled={busy}>
              Keep it
            </button>
          </>
        )}
      </div>
      {confirming && <p className="text-xs text-muted">Removes your email, saved settings and plans from Game Day. Links you&apos;ve shared keep working.</p>}
      {msg && (
        <p className="text-sm" role="status">
          {msg}
        </p>
      )}
    </section>
  );
}
