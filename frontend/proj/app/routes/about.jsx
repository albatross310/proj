import { Link } from "react-router";
import { aboutDotComma } from "../about.jsx";
import SiteFooter from "../SiteFooter.jsx";
import LogoMark from "../LogoMark.jsx";

const SITE_URL = "https://dotcomma.com.au";
const TITLE = "About DotComma — building a shared bridge language";
const DESCRIPTION =
  "Why DotComma exists: a low-friction auxiliary language layer that helps " +
  "people communicate across English, Mandarin, Vietnamese and beyond — " +
  "taught playfully through a constrained-vocabulary writing game.";

export function meta() {
  return [
    { title: TITLE },
    { name: "description", content: DESCRIPTION },
    { tagName: "link", rel: "canonical", href: `${SITE_URL}/about` },
    { property: "og:type", content: "article" },
    { property: "og:title", content: TITLE },
    { property: "og:description", content: DESCRIPTION },
    { property: "og:url", content: `${SITE_URL}/about` },
    { property: "og:image", content: `${SITE_URL}/og.png` },
    { name: "twitter:card", content: "summary_large_image" }
  ];
}

export default function About() {
  const paragraphs = aboutDotComma
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  return (
    <main style={{ maxWidth: 680, margin: "0 auto", padding: "48px 24px", textAlign: "justify" }}>
      <h1 style={{ fontSize: 38, marginBottom: 8, textAlign: "left" }}>
        <LogoMark size={42} />
        <span className="dc-title">About DotComma</span>
      </h1>
      <p style={{ fontSize: 20, opacity: 0.85, marginTop: 0 }}>
        A constrained-language game — and the onboarding layer for a
        low-pressure bridge-language community.
      </p>

      <p style={{ fontSize: 17, lineHeight: 1.6 }}>
        DotComma teaches people to write within a small, shared vocabulary of
        short, plain words. That constraint is the point: it is practice for a
        future <strong>bridge language</strong> — a simple, low-friction layer
        that helps people communicate across English, Mandarin, Vietnamese and
        other language communities.
      </p>

      <h2 style={{ fontSize: 26, marginTop: 36, textAlign: "left" }}>The bigger idea</h2>
      <div style={{ textAlign: "justify" }}>
        {paragraphs.map((p, i) => (
          <p key={i} style={{ fontSize: 16, lineHeight: 1.6, marginBottom: 16 }}>
            {p}
          </p>
        ))}
      </div>

      <p style={{ marginTop: 32 }}>
        <Link
          to="/"
          className="dc-button"
          style={{
            padding: "12px 24px",
            borderRadius: 999,
            textDecoration: "none",
            display: "inline-block"
          }}
        >
          Play DotComma
        </Link>
      </p>

      <SiteFooter />
    </main>
  );
}
