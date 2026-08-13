import {
  getSiteUrl,
  publicImages,
  SITE_DESCRIPTION,
  SITE_NAME,
} from "@/lib/seo";

export function SiteJsonLd() {
  const url = getSiteUrl();
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${url}/#org`,
        name: SITE_NAME,
        url,
        logo: `${url}${publicImages.icon}`,
        image: `${url}${publicImages.og}`,
        description: SITE_DESCRIPTION,
      },
      {
        "@type": "WebSite",
        "@id": `${url}/#website`,
        url,
        name: SITE_NAME,
        description: SITE_DESCRIPTION,
        inLanguage: "en-IN",
        publisher: { "@id": `${url}/#org` },
      },
      {
        "@type": "WebApplication",
        "@id": `${url}/#app`,
        name: `${SITE_NAME} Gate Kiosk`,
        url,
        applicationCategory: "SecurityApplication",
        operatingSystem: "Web",
        description: SITE_DESCRIPTION,
        image: `${url}${publicImages.og}`,
        publisher: { "@id": `${url}/#org` },
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "INR",
        },
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
