import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  const base = getSiteUrl();

  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/login", "/og.png", "/icon.png", "/favicon.ico"],
      disallow: ["/dashboard", "/dashboard/", "/a/", "/api/", "/gate"],
    },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
