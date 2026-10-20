import { NextResponse } from "next/server";
import { getSource } from "@/lib/db/source";
import { serverError } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 40);
  if (q.length < 2) return NextResponse.json({ teams: [] });
  try {
    const src = await getSource();
    const teams = await src.searchTeams(q, 12);
    return NextResponse.json({ teams }, { headers: { "cache-control": "public, s-maxage=3600" } });
  } catch (e) {
    return serverError(e);
  }
}
