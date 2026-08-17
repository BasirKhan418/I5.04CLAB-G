import type { Metadata, Viewport } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
import { DoorPresenceProvider } from "@/components/door-presence-provider";
import { SiteJsonLd } from "@/components/site-json-ld";
import {
  getSiteUrl,
  publicImages,
  SITE_DESCRIPTION,
  SITE_NAME,
} from "@/lib/seo";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-serif",
  subsets: ["latin"],
});

const siteUrl = getSiteUrl();

export const viewport: Viewport = {
  themeColor: "#fff9f2",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${SITE_NAME} — Gate kiosk for members and visitors`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "I5.04C Lab",
    "I5.04C",
    "lab gate kiosk",
    "lab access control",
    "member check-in",
    "visitor request",
    "lab hours tracker",
    "WhatsApp lab alerts",
    "PIN OTP lab login",
  ],
  authors: [{ name: SITE_NAME, url: siteUrl }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: "technology",
  referrer: "origin-when-cross-origin",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: [
      { url: publicImages.favicon, sizes: "32x32", type: "image/x-icon" },
      { url: publicImages.faviconSvg, type: "image/svg+xml" },
      { url: publicImages.icon, sizes: "1024x1024", type: "image/png" },
    ],
    apple: [{ url: publicImages.apple, sizes: "180x180", type: "image/png" }],
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "/",
    siteName: SITE_NAME,
    title: `${SITE_NAME} — Gate kiosk for members and visitors`,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: publicImages.og,
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} gate kiosk`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — Gate kiosk for members and visitors`,
    description: SITE_DESCRIPTION,
    images: [publicImages.og],
  },
  appleWebApp: {
    capable: true,
    title: SITE_NAME,
    statusBarStyle: "default",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en-IN"
      className={`${dmSans.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col overflow-x-hidden bg-cream text-ink font-sans">
        <SiteJsonLd />
        <DoorPresenceProvider>{children}</DoorPresenceProvider>
      </body>
    </html>
  );
}
