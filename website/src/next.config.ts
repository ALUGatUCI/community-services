import type { NextConfig } from "next";

// Hosts allowed to load Next.js dev-only resources (/_next/*). Without this,
// accessing the dev server from a non-localhost origin blocks the client
// JS/HMR, so pages render but never hydrate. Comma-separated in
// ALLOWED_DEV_ORIGINS, e.g. "147.135.115.199,dev.example.com".
const allowedDevOrigins = (process.env.ALLOWED_DEV_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

// The browser only talks to this app's own /api/* route handlers; those proxy
// to the container-api server-side, so no rewrites to external backends are
// needed.
const nextConfig: NextConfig = {
  allowedDevOrigins,
};

export default nextConfig;
