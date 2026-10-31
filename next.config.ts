import type { NextConfig } from "next";
import { networkInterfaces } from "node:os";

// Same-origin proxy target for local development. Production deployments
// should set NEXT_PUBLIC_API_BASE_URL and/or API_PROXY_TARGET explicitly;
// the localhost fallback is never used in a production build.
const apiProxyTarget = (
  process.env.API_PROXY_TARGET ?? ""
).trim().replace(/\/+$/, "");

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", ...Object.values(networkInterfaces()).flatMap(entries => (entries || []).filter(entry => entry.family === "IPv4").map(entry => entry.address))],
  async rewrites() {
    if (!apiProxyTarget) return [];
    return [{ source: "/api/v1/:path*", destination: `${apiProxyTarget}/api/v1/:path*/` }];
  },
  /* config options here */
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
