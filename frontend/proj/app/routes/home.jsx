import App from "../App.jsx";
import SiteFooter from "../SiteFooter.jsx";

const SITE_URL = "https://dotcomma.com.au";
const TITLE = "DotComma — a constrained-language game";
const DESCRIPTION =
  "DotComma is a playful language game: solve lines using only short, " +
  "plain words. The onboarding layer for a low-friction bridge-language " +
  "community across English, Mandarin, Vietnamese and more.";

export function meta() {
  const ogImage = `${SITE_URL}/og.png`;
  return [
    { title: TITLE },
    { name: "description", content: DESCRIPTION },
    {
      name: "keywords",
      content:
        "DotComma, language game, constrained writing, plain words, " +
        "word game, bridge language, simple English, vocabulary game"
    },
    { name: "author", content: "DotComma" },
    { name: "robots", content: "index, follow" },

    // Canonical
    { tagName: "link", rel: "canonical", href: `${SITE_URL}/` },

    // Open Graph
    { property: "og:type", content: "website" },
    { property: "og:site_name", content: "DotComma" },
    { property: "og:title", content: TITLE },
    { property: "og:description", content: DESCRIPTION },
    { property: "og:url", content: `${SITE_URL}/` },
    { property: "og:image", content: ogImage },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { property: "og:image:alt", content: "DotComma — a constrained-language game" },
    { property: "og:locale", content: "en_AU" },

    // Twitter
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: TITLE },
    { name: "twitter:description", content: DESCRIPTION },
    { name: "twitter:image", content: ogImage },

    // Structured data (schema.org)
    {
      "script:ld+json": {
        "@context": "https://schema.org",
        "@type": "WebApplication",
        name: "DotComma",
        url: `${SITE_URL}/`,
        description: DESCRIPTION,
        applicationCategory: "GameApplication",
        operatingSystem: "Any (web browser)",
        browserRequirements: "Requires JavaScript",
        image: ogImage,
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" }
      }
    }
  ];
}

export default function Home() {
  return (
    <>
      <App />
      <SiteFooter />
    </>
  );
}
