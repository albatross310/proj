import { Link } from "react-router";
import SiteFooter from "../SiteFooter.jsx";
import LogoMark from "../LogoMark.jsx";

const SITE_URL = "https://dotcomma.com.au";
const TITLE = "How to play DotComma — the constrained-language word game";
const DESCRIPTION =
  "Learn how to play DotComma: rewrite each line using only short, plain " +
  "words from a small shared vocabulary. Rules, scoring, valid words, and " +
  "tips for writing with zest.";

export function meta() {
  return [
    { title: TITLE },
    { name: "description", content: DESCRIPTION },
    { tagName: "link", rel: "canonical", href: `${SITE_URL}/how-to-play` },
    { property: "og:type", content: "article" },
    { property: "og:title", content: TITLE },
    { property: "og:description", content: DESCRIPTION },
    { property: "og:url", content: `${SITE_URL}/how-to-play` },
    { property: "og:image", content: `${SITE_URL}/og.png` },
    { name: "twitter:card", content: "summary_large_image" },
    {
      "script:ld+json": {
        "@context": "https://schema.org",
        "@type": "HowTo",
        name: "How to play DotComma",
        description: DESCRIPTION,
        step: [
          { "@type": "HowToStep", name: "Read the line", text: "Each round gives you a line to rewrite." },
          { "@type": "HowToStep", name: "Use short, plain words", text: "Rewrite it using only words from DotComma's small shared vocabulary." },
          { "@type": "HowToStep", name: "Submit", text: "Valid words turn green; off-list words turn red. Submit to score." },
          { "@type": "HowToStep", name: "Compare", text: "See other players' top answers and like the best ones." }
        ]
      }
    }
  ];
}

export default function HowToPlay() {
  const h2 = { fontSize: 26, marginTop: 36, textAlign: "left" };
  const p = { fontSize: 16, lineHeight: 1.6 };
  return (
    <main style={{ maxWidth: 680, margin: "0 auto", padding: "48px 24px", textAlign: "justify" }}>
      <h1 style={{ fontSize: 38, marginBottom: 8, textAlign: "left" }}>
        <LogoMark size={42} />
        <span className="dc-title">How to play DotComma</span>
      </h1>
      <p style={{ fontSize: 20, opacity: 0.85, marginTop: 0 }}>
        A word game about saying more with fewer, simpler words.
      </p>

      <p style={p}>
        DotComma is a <strong>constrained-language game</strong>. Each round
        shows you a line, and your job is to rewrite it using only{" "}
        <strong>short, plain words</strong> drawn from DotComma's small shared
        vocabulary. The constraint forces clarity — and quietly trains you to
        write in a simple, universal way.
      </p>

      <h2 style={h2}>The rules</h2>
      <ol style={{ ...p, paddingLeft: 22 }}>
        <li>Read the line you're given.</li>
        <li>Rewrite it in your own words — but only using allowed short words.</li>
        <li>
          As you type, valid words turn <span style={{ color: "#15803d" }}>green</span>{" "}
          and off-list words turn <span style={{ color: "#e11d48" }}>red</span>.
        </li>
        <li>Submit your line to see your result and score.</li>
      </ol>

      <h2 style={h2}>How scoring works</h2>
      <p style={p}>
        An answer where <strong>every word is valid</strong> earns the most
        points, with a small bonus for being short and to the point. Off-list
        words don't score. The aim isn't to be clever with rare words — it's to
        be clear with common ones.
      </p>

      <h2 style={h2}>Learning from other players</h2>
      <p style={p}>
        After you submit, you'll see the <strong>top answers from other
        players</strong> for the same line. You can like the ones you admire,
        and borrow their structure next time. It's a gentle, low-pressure way
        to learn to write with zest.
      </p>

      <h2 style={h2}>Why short words?</h2>
      <p style={p}>
        Writing within a constrained vocabulary is practice for a shared{" "}
        <Link to="/about" style={{ color: "var(--accent)" }}>bridge language</Link>{" "}
        — a simple layer that can carry meaning across English, Mandarin,
        Vietnamese and more. Plain words travel further.
      </p>

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
