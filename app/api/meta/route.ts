import { NextResponse } from "next/server";
import { getSource, usingFixtures } from "@/lib/db/source";
import { FIXTURE_DAY } from "@/lib/db/fixtures";
import { serverError } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const src = await getSource();
    const [leagues, services] = await Promise.all([src.leagues(), src.services()]);
    return NextResponse.json(
      { leagues, services, fixtureMode: usingFixtures(), demoDay: usingFixtures() ? FIXTURE_DAY : null },
      { headers: { "cache-control": "public, s-maxage=600, stale-while-revalidate=3600" } },
    );
  } catch (e) {
    return serverError(e);
  }
}
