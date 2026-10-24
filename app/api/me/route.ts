import { NextResponse } from "next/server";
import { getSource } from "@/lib/db/source";
import { currentUser } from "@/lib/supabase/server";
import { AccountPrefsSchema } from "@/lib/server/accountSchema";
import { bad, serverError } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "cache-control": "private, no-store" };

/** The signed-in visitor and their saved settings (null when signed out). */
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ user: null, prefs: null }, { headers: noStore });
  try {
    const src = await getSource();
    const saved = await src.getAccountPrefs(user.id);
    return NextResponse.json(
      { user: { id: user.id, email: user.email }, prefs: saved?.prefs ?? null, updatedAt: saved?.updatedAt ?? null },
      { headers: noStore },
    );
  } catch (e) {
    return serverError(e);
  }
}

export async function PUT(req: Request) {
  const user = await currentUser();
  if (!user) return bad("Not signed in", 401);
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return bad("Invalid JSON");
  }
  const parsed = AccountPrefsSchema.safeParse(body);
  if (!parsed.success) return bad("Invalid settings");
  try {
    const src = await getSource();
    const updatedAt = await src.saveAccountPrefs(user.id, parsed.data);
    return NextResponse.json({ updatedAt }, { headers: noStore });
  } catch (e) {
    return serverError(e);
  }
}

/** Delete the account and everything saved to it. Plans already shared by link stay up (they hold no account data). */
export async function DELETE() {
  const user = await currentUser();
  if (!user) return bad("Not signed in", 401);
  try {
    const src = await getSource();
    await src.deleteAccount(user.id);
    return new Response(null, { status: 204 });
  } catch (e) {
    return serverError(e);
  }
}
