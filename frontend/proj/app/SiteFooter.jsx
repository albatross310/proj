import { Link } from "react-router";

// Internal links across the content pages (helps SEO + navigation).
export default function SiteFooter() {
  const linkStyle = {
    color: "var(--accent)",
    textDecoration: "none",
    fontWeight: 600,
    margin: "0 12px"
  };
  return (
    <footer
      style={{
        textAlign: "center",
        fontSize: 15,
        padding: "32px 0",
        opacity: 0.85
      }}
    >
      <Link to="/" style={linkStyle}>Play</Link>
      <Link to="/about" style={linkStyle}>About</Link>
      <Link to="/how-to-play" style={linkStyle}>How to play</Link>
    </footer>
  );
}
