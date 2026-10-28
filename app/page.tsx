import type { Metadata } from "next";
import { BrowsePage } from "@/components/BrowsePage";
import { APP_NAME, APP_TAGLINE } from "@/lib/config";
import { dayParts } from "@/lib/time";

type Params = { searchParams: Promise<{ day?: string }> };

export async function generateMetadata({ searchParams }: Params): Promise<Metadata> {
  const { day } = await searchParams;
  const valid = day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
  const image = `/api/og/day${valid ? `?day=${valid}` : ""}`;
  const title = valid ? `${dayParts(valid).weekday}, ${dayParts(valid).date} · ${APP_NAME}` : APP_NAME;
  return {
    title: { absolute: title },
    description: APP_TAGLINE,
    openGraph: { title, description: APP_TAGLINE, images: [{ url: image, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title, description: APP_TAGLINE, images: [image] },
  };
}

export default function Page() {
  return <BrowsePage />;
}
