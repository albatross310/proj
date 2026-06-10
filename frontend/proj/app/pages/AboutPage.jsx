import { aboutDotComma } from "../about.jsx";
import { containerStyle, buttonStyle } from "../styles.js";

// \n marks paragraph breaks in the source; HTML collapses raw newlines, so
// split into real <p> elements here.
const aboutParagraphs = aboutDotComma
  .split(/\n\s*\n/)
  .map((p) => p.replace(/\s+/g, " ").trim())
  .filter(Boolean);

export default function AboutPage({ menu, onBack }) {
  return (
    <div className="dc-card-page" style={containerStyle}>
      {menu}
      <br /><br />
      <h2>About DotComma</h2>
      <br />
      <div style={{ textAlign: "left" }}>
        {aboutParagraphs.map((p, i) => (
          <p key={i} style={{ marginBottom: 16 }}>{p}</p>
        ))}
      </div>
      <br />
      <button className="dc-button" style={buttonStyle} onClick={onBack}>
        Back
      </button>
      <br /><br />
    </div>
  );
}
