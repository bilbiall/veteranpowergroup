import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "100mb",
    },
  },
  distDir: process.env.APP_SURFACE === "portal"
    ? ".next-portal"
    : process.env.APP_SURFACE === "website"
      ? ".next-website"
      : ".next",
};

export default nextConfig;
