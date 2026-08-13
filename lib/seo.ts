import type { Metadata } from "next";

export const SITE_NAME = "I5.04C Lab";
export const SITE_SHORT_NAME = "I5.04C";
export const SITE_DESCRIPTION =
  "I5.04C Lab gate kiosk and access tracker — member PIN or OTP check-in, visitor requests, lab hours, door control, and WhatsApp alerts.";

export const publicImages = {
  og: "/og.png",
  icon: "/icon.png",
  icon192: "/icon-192.png",
  icon512: "/icon-512.png",
  apple: "/apple-touch-icon.png",
  favicon: "/favicon.ico",
  faviconSvg: "/favicon.svg",
} as const;

export function getSiteUrl() {
  const host = process.env.PUBLIC_HOST?.replace(/\/$/, "");
  if (host) return host;
  const vercel = process.env.VERCEL_URL?.replace(/\/$/, "");
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}

export function pageMetadata({
  title,
  description,
  path,
  index = true,
  image = publicImages.og,
  absoluteTitle,
}: {
  title: string;
  description: string;
  path: string;
  index?: boolean;
  image?: string;
  absoluteTitle?: string;
}): Metadata {
  const ogTitle = absoluteTitle ?? `${title} | ${SITE_NAME}`;

  return {
    title: absoluteTitle ? { absolute: absoluteTitle } : title,
    description,
    alternates: { canonical: path },
    robots: {
      index,
      follow: index,
      googleBot: {
        index,
        follow: index,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
    openGraph: {
      title: ogTitle,
      description,
      url: path,
      siteName: SITE_NAME,
      locale: "en_IN",
      type: "website",
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: `${SITE_NAME} — ${title}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description,
      images: [image],
    },
  };
}
