import type { MetadataRoute } from "next";
import { getSiteUrl, publicImages } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl();
  const now = new Date();

  return [
    {
      url: base,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
      images: [`${base}${publicImages.og}`, `${base}${publicImages.icon}`],
    },
    {
      url: `${base}/login`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
      images: [`${base}${publicImages.og}`],
    },
  ];
}
