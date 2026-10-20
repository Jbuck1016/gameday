import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import "@fontsource/anton/400.css";
import "@fontsource/barlow-condensed/600.css";
import "@fontsource/barlow-condensed/700.css";
import "@fontsource/barlow/400.css";
import "@fontsource/barlow/500.css";
import "@fontsource/barlow/600.css";
import "@fontsource/newsreader/400.css";
import "@fontsource/newsreader/400-italic.css";
import "@fontsource/newsreader/600.css";
import "@fontsource/public-sans/400.css";
import "@fontsource/public-sans/600.css";
import "@fontsource/public-sans/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/700.css";
import "@fontsource/jetbrains-mono/800.css";
import "./globals.css";
import { PrefsProvider } from "@/lib/prefs";
import { AppShell } from "@/components/AppShell";
import { APP_NAME, APP_TAGLINE } from "@/lib/config";

const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: APP_TAGLINE,
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

// theme is applied before paint from localStorage to avoid a flash of the default skin
const themeBoot = `try{var t=new URLSearchParams(location.search).get('theme');if(!t){var p=JSON.parse(localStorage.getItem('gameday:v1')||'{}');t=p.theme}if(['broadcast','editorial','terminal'].indexOf(t)>=0)document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="broadcast" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
      </head>
      <body>
        <PrefsProvider>
          <AppShell>{children}</AppShell>
        </PrefsProvider>
        <Analytics />
      </body>
    </html>
  );
}
