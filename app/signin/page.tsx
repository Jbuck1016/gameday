import type { Metadata } from "next";
import { SignIn } from "@/components/SignIn";

export const metadata: Metadata = { title: "Sign in" };

export default function Page() {
  return <SignIn />;
}
