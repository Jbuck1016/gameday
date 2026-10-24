// Public Supabase settings for sign-in. The publishable key is meant to ship to browsers; data access
// for Game Day still goes through the server and the scoped gameday_web role, never PostgREST.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://soknxaqllvdpshezjbnw.supabase.co";
export const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_aH1CSPiJu5UT3eABBL_keg_B8r3wpqD";
/** Email sign-in links need a sending domain; turn on with NEXT_PUBLIC_EMAIL_SIGNIN=1 once SMTP is set up. */
export const EMAIL_SIGNIN = process.env.NEXT_PUBLIC_EMAIL_SIGNIN === "1";
