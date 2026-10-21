import type { MetadataRoute } from "next";
import { solutions } from "@/lib/solutions";
import { siteUrl } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: siteUrl, changeFrequency: "weekly", priority: 1 },
    ...Object.keys(solutions).map((slug) => ({ url: `${siteUrl}/solutions/${slug}`, changeFrequency: "monthly" as const, priority: 0.9 })),
    { url: `${siteUrl}/portfolio`, changeFrequency: "weekly", priority: 0.7 },
  ];
}
