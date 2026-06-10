import LogoMark from "../LogoMark.jsx";
import { introPages } from "../about.jsx";
import { containerStyle } from "../styles.js";

// Click-to-advance welcome sequence. introIndex lives in App so progress
// survives a trip to the About/Settings pages and back.
export default function IntroPage({ menu, introIndex, setIntroIndex, onAbout, onDone }) {
  return (
    <div
      onClick={() => {
        if (introIndex < introPages.length) setIntroIndex((i) => i + 1);
        else onDone();
      }}
      style={{ textAlign: "center", marginTop: 100, fontSize: 24, cursor: "pointer" }}
    >
      <div className="dc-card-page" style={containerStyle}>
        {menu}
        <h2 style={{ fontSize: 32 }}>
          <br /><LogoMark size={38} /><span className="dc-title">Welcome to DotComma</span>
        </h2>
        <br />
        {introIndex === 0 ? (
          <div className="dc-hint" style={{ fontSize: 14, marginTop: 40 }}>
            CLICK ANYWHERE TO CONTINUE
          </div>
        ) : (
          <div style={{ fontSize: 20 }}>
            {introPages.slice(0, introIndex).map((line, i) => (
              <div key={i} style={{ marginTop: 10 }}>{line}</div>
            ))}
          </div>
        )}
        <div
          style={{ position: "absolute", bottom: 20, left: 0, width: "100%", fontSize: 14, textAlign: "center" }}
        >
          For more information, see{" "}
          <span
            className="no-advance dc-about-link"
            onClick={(e) => {
              e.stopPropagation();
              onAbout();
            }}
          >
            About
          </span>
        </div>
      </div>
    </div>
  );
}
