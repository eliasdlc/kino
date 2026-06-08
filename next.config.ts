import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development", // Desactivar en desarrollo para evitar caché molesto
  register: true,
  workboxOptions: {
    skipWaiting: true,
  }
});

const nextConfig: NextConfig = {
  /* config options here */
  turbopack: {

  },
  reactStrictMode: true,
  // Workspace package shipping ESM tool definitions reused by the /api/mcp route.
  transpilePackages: ["@kino-app/mcp"],
};

export default withPWA(nextConfig);