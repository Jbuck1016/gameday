import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSource } from "@/lib/db/source";
import { loadPlanGames } from "@/lib/server/load";
import { planDays } from "@/lib/plan";
import { formatDayLabel } from "@/lib/time";
import { SharedPlan } from "@/components/SharedPlan";
import { APP_NAME } from "@/lib/config";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }>; searchParams: Promise<{ day?: string }> };

async function load(slug: string) {
  if (!/^[A-Za-z0-9]{4,16}$/.test(slug)) return null;
  const src = await getSource();
  const plan = await src.getPlan(slug);
  if (!plan) return null;
  const games = await loadPlanGames(plan);
  return { plan, games };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const data = await load(slug).catch(() => null);
  if (!data) return { title: "Plan not found" };
  const title = `${formatDayLabel(data.plan.dateFrom)} · ${APP_NAME}`;
  const image = `/api/card?plan=${slug}&theme=${data.plan.theme}`;
  return {
    title,
    description: `${data.plan.items.length} games${data.plan.areaLabel ? ` · ${data.plan.areaLabel}` : ""}`,
    openGraph: { title, images: [{ url: image, width: 1080, height: 1350 }] },
    twitter: { card: "summary_large_image", images: [image] },
  };
}

export default async function Page({ params, searchParams }: Params) {
  const { slug } = await params;
  const { day } = await searchParams;
  const data = await load(slug);
  if (!data) notFound();
  const days = planDays(data.games.map((g) => g.start), data.plan.timezone);
  const selected = day && days.includes(day) ? day : (days[0] ?? data.plan.dateFrom);
  return (
    <div className="space-y-8 pb-10">
      <SharedPlan plan={data.plan} games={data.games} day={selected} days={days} />
      <div className="panel flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="text-sm">Plan your own day, with listings for where you live.</p>
        <Link href="/" className="btn btn-primary no-underline">
          Make my plan
        </Link>
      </div>
    </div>
  );
}
