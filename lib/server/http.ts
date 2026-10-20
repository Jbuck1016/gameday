import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";

export function csv(v: string | null): string[] {
  return (v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function serverError(e: unknown) {
  console.error(e);
  return NextResponse.json({ error: "Something went wrong reading the schedule. Try again in a minute." }, { status: 503 });
}

export const idList = z.array(z.string().regex(/^[a-z0-9.\-]+:[0-9a-zA-Z_\-]+$/)).max(400);

export async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd ? fwd.split(",")[0] : req.headers.get("x-real-ip")) ?? "unknown";
}
