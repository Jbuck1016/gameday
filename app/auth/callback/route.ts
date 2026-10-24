import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Where Google and email sign-in links land: swap the one-time code for a session cookie, then go back. */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const code = u.searchParams.get("code");
  const nextParam = u.searchParams.get("next") ?? "/";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/";
  if (!code) return NextResponse.redirect(new URL("/signin?error=missing", u.origin));
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL("/signin?error=expired", u.origin));
  const dest = new URL(next, u.origin);
  dest.searchParams.set("signed_in", "1");
  return NextResponse.redirect(dest);
}
