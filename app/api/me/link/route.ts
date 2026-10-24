import { z } from "zod";
import { getSource } from "@/lib/db/source";
import { currentUser } from "@/lib/supabase/server";
import { bad } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ visitor: z.string().regex(/^[A-Za-z0-9]{8,32}$/) });

/** Ties this browser's anonymous visitor id to the account, so one person on two devices counts once. */
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return bad("Not signed in", 401);
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return bad("Invalid visitor");
  try {
    const src = await getSource();
    await src.linkVisitor(user.id, parsed.data.visitor);
  } catch (e) {
    console.error("link failed", e);
  }
  return new Response(null, { status: 204 });
}
