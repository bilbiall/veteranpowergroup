import type { NextConfig } from "next";

const onVercel = Boolean(process.env.VERCEL);

const nextConfig: NextConfig = {
  // Standalone output + per-surface build folders are for self-hosting (cPanel). Vercel needs the defaults.
  ...(onVercel
    ? {}
    : {
        output: "standalone" as const,
        distDir: process.env.APP_SURFACE === "portal"
          ? ".next-portal"
          : process.env.APP_SURFACE === "website"
            ? ".next-website"
            : ".next",
      }),
  experimental: {
    serverActions: {
      // Vercel functions reject request bodies above ~4.5MB; logos are the only upload and are resized server-side.
      bodySizeLimit: "4mb",
    },
  },
  // Files read from disk at runtime must be bundled into the serverless functions.
  outputFileTracingIncludes: {
    "/": ["./public/About-location/**", "./public/power-solutions/**", "./public/solar-solutions/**", "./public/borehole-solutions/**", "./public/project-reports/**"],
    "/portfolio": ["./public/About-location/**", "./public/power-solutions/**", "./public/solar-solutions/**", "./public/borehole-solutions/**", "./public/project-reports/**"],
    "/solutions/[slug]": ["./public/About-location/**", "./public/power-solutions/**", "./public/solar-solutions/**", "./public/borehole-solutions/**", "./public/project-reports/**"],
    "/api/documents/[id]/export": ["./public/veteran-watermark.png"],
    "/api/exports/all": ["./public/veteran-watermark.png"],
  },
};

export default nextConfig;
