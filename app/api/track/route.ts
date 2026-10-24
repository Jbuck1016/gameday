import { z } from "zod";
import { getSource } from "@/lib/db/source";
import { bad } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Id = z.string().regex(/^[A-Za-z0-9]{8,32}$/);
const Prop = z.union([z.string().max(120), z.number().finite(), z.boolean(), z.null()]);

const Body = z.object({
  v: Id,
  s: Id,
  i: z.boolean().optional(),
  events: z
    .array(
      z.object({
        n: z.string().regex(/^[a-z_]{2,40}$/),
        path: z.string().max(200).nullable().optional(),
        p: z.record(z.string().max(40), Prop).optional(),
      }),
    )
    .min(1)
    .max(25),
});

const BOT = /bot|crawl|spider|slurp|preview|headless|lighthouse/i;

/** First-party event log (beacon target). Always answers 204 so a failed log never surfaces to the visitor. */
export async function POST(req: Request) {
  const text = await req.text();
  if (text.length > 16_000) return bad("Too large", 413);
  if (BOT.test(req.headers.get("user-agent") ?? "")) return new Response(null, { status: 204 });
  let parsed;
  try {
    parsed = Body.safeParse(JSON.parse(text));
  } catch {
    return bad("Invalid JSON");
  }
  if (!parsed.success) return bad("Invalid events");
  const b = parsed.data;
  try {
    const src = await getSource();
    await src.logEvents(
      b.events.map((e) => {
        const props = Object.fromEntries(Object.entries(e.p ?? {}).slice(0, 12));
        return { visitor: b.v, session: b.s, name: e.n, path: e.path ?? null, props, internal: Boolean(b.i) };
      }),
    );
  } catch (e) {
    console.error("track failed", e);
  }
  return new Response(null, { status: 204 });
}
