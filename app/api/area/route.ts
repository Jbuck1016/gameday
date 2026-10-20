import { NextResponse } from "next/server";
import { geolocation } from "@vercel/functions";
import { getSource, usingFixtures } from "@/lib/db/source";
import { FIXTURE_LA } from "@/lib/db/fixtures";
import { bad, serverError } from "@/lib/server/http";
import type { LocalTeam } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AreaResponse = {
  source: "ip" | "zip" | "none";
  label: string | null;
  lat: number | null;
  lon: number | null;
  zip: string | null;
  teams: LocalTeam[];
};

function safeDecode(s: string | undefined): string | null {
  if (!s) return null;
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** Free zip geocoder, used only for zips not yet in gameday_site.zip_centroids; results are saved. */
async function geocodeZip(zip: string): Promise<{ lat: number; lon: number; label: string } | null> {
  try {
    const res = await fetch(`https://api.zippopotam.us/us/${zip}`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const j = (await res.json()) as { places?: { latitude: string; longitude: string; "place name": string; "state abbreviation": string }[] };
    const p = j.places?.[0];
    if (!p) return null;
    const lat = Number(p.latitude);
    const lon = Number(p.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { lat, lon, label: `${p["place name"]}, ${p["state abbreviation"]}` };
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const u = new URL(req.url);
  const zip = u.searchParams.get("zip");
  try {
    const src = await getSource();
    if (zip !== null) {
      if (!/^\d{5}$/.test(zip)) return bad("Enter a 5-digit US zip code");
      const known = await src.suggestLocalTeamsForZip(zip);
      if (known) {
        return NextResponse.json({ source: "zip", label: `ZIP ${zip}`, lat: null, lon: null, zip, teams: known } satisfies AreaResponse);
      }
      const geo = await geocodeZip(zip);
      if (!geo) return bad("We couldn't find that zip code", 404);
      await src.saveZip(zip, geo.lat, geo.lon).catch(() => {});
      const teams = await src.suggestLocalTeams(geo.lat, geo.lon);
      return NextResponse.json({ source: "zip", label: geo.label, lat: geo.lat, lon: geo.lon, zip, teams } satisfies AreaResponse);
    }

    const g = geolocation(req);
    let lat = g.latitude ? Number(g.latitude) : NaN;
    let lon = g.longitude ? Number(g.longitude) : NaN;
    let label = [safeDecode(g.city), g.countryRegion].filter(Boolean).join(", ") || null;
    if ((!Number.isFinite(lat) || !Number.isFinite(lon)) && usingFixtures()) {
      lat = FIXTURE_LA.lat;
      lon = FIXTURE_LA.lon;
      label = FIXTURE_LA.label;
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || (g.country && g.country !== "US" && !usingFixtures())) {
      return NextResponse.json({ source: "none", label: null, lat: null, lon: null, zip: null, teams: [] } satisfies AreaResponse);
    }
    const teams = await src.suggestLocalTeams(lat, lon);
    return NextResponse.json({ source: "ip", label, lat, lon, zip: null, teams } satisfies AreaResponse, {
      headers: { "cache-control": "private, no-store" },
    });
  } catch (e) {
    return serverError(e);
  }
}
