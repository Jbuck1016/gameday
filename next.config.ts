import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // the PNG card reads these font files at runtime; make sure Vercel ships them with the function
  outputFileTracingIncludes: {
    "/api/card": ["./lib/og/fonts/**"],
  },
  // fixtures are only used in local/test mode, but must ship so fixture mode works in previews too
  poweredByHeader: false,
};

export default nextConfig;
