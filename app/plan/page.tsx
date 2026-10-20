import type { Metadata } from "next";
import { PlanPage } from "@/components/PlanPage";

export const metadata: Metadata = { title: "Your plan" };

export default function Page() {
  return <PlanPage />;
}
