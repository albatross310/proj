import { gamePages, headings, clue, hints, renderFormatted } from "../prompts.jsx";
import { containerStyle, boxStyle, buttonRowStyle, buttonStyle } from "../styles.js";

// The play surface: progressive reveal of the prompt/clue, then the type-box.
// text / validated / reveal state live in App (so progress survives a detour
// to settings) and arrive as props; words + wordColors are precomputed there.
export default function GamePage({
  menu,
  promptIndex,
  revealMode,
  setRevealMode,
  hideRevealToggle,
  revealIndex,
  setRevealIndex,
  isTyping,
  setIsTyping,
  text,
  setText,
  words,
  wordColors,
  inputRef,
  onSubmit,
  onGoBack
}) {
  // With reveal mode on, each part below the prompt takes a further click:
  // text stages -> clue -> typing area. With it off, show everything.
  const stages = [...gamePages[promptIndex].intro, gamePages[promptIndex].prompt];
  const revealAll = !revealMode;
  const textShown = revealAll ? stages.length : Math.min(revealIndex, stages.length);
  const hasClue = clue[promptIndex] && clue[promptIndex] !== "NA";
  const playAt = stages.length + (hasClue ? 1 : 0);
  const clueShown = hasClue && (revealAll || revealIndex > stages.length);
  const fullDone = revealAll || revealIndex > playAt;

  return (
    <div
      onClick={() => {
        if (!fullDone && !isTyping) setRevealIndex((i) => i + 1);
      }}
      style={{ textAlign: "center", marginTop: 100, fontSize: 24 }}
    >
      <div className="dc-card-page" style={containerStyle}>
        {menu}
        {!hideRevealToggle && (
          <label
            className="dc-switch"
            onClick={(e) => e.stopPropagation()}
            style={{ position: "absolute", top: 16, left: 18, zIndex: 5 }}
          >
            <input
              type="checkbox"
              checked={revealMode}
              onChange={(e) => {
                const on = e.target.checked;
                setRevealMode(on);
                localStorage.setItem("dotcomma_reveal", on ? "on" : "off");
              }}
            />
            <span className="track" />
            Progressive Reveal
          </label>
        )}
        <h2 style={{ minHeight: 200 }}>
          <br /><br />
          {headings[promptIndex]}
          {!revealAll && revealIndex === 0 && (
            <p className="dc-hint" style={{ fontSize: 14 }}>
              CLICK ANYWHERE TO CONTINUE
            </p>
          )}
          {stages.slice(0, textShown).map((line, i) => (
            <div
              key={i}
              className={i === stages.length - 1 ? "dc-shimmer" : undefined}
              style={{ marginBottom: i === stages.length - 1 ? 0 : 18 }}
            >
              {renderFormatted(line)}
            </div>
          ))}
        </h2>
        {clueShown && (
          <h2>
            {clue[promptIndex].split(" ").map((word, i) => (
              <span key={i} style={{ marginRight: 10, letterSpacing: 2 }}>{word}</span>
            ))}
          </h2>
        )}
        {clueShown && !fullDone && (
          <>
            <br />
            <p className="dc-hint" style={{ fontSize: 14 }}>
              CLICK ANYWHERE TO CONTINUE
            </p>
          </>
        )}
        {fullDone && (
          <>
            <div
              onClick={() => {
                inputRef.current?.focus();
                setIsTyping(true);
              }}
              className="dc-typebox"
              style={{ ...boxStyle, margin: "30px 0", cursor: "text" }}
            >
              {words.map((t, i) => (
                <span key={i} style={{ color: wordColors[i], marginRight: 4 }}>{t}</span>
              ))}
              <span className="dc-caret">|</span>
            </div>
            <textarea // invisible input — captures typing
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              autoFocus
              style={{ position: "absolute", opacity: 0, pointerEvents: "none" }}
            />
            <div style={buttonRowStyle}>
              <button className="dc-button" style={buttonStyle} onClick={onSubmit}>
                Enter
              </button>
              {promptIndex > 0 && (
                <button className="dc-button" style={buttonStyle} onClick={onGoBack}>
                  Go Back
                </button>
              )}
            </div>
            <br />
            <p style={{ fontSize: 16, opacity: 0.7 }}>
              Answers are shared with other players.
            </p>
            {hints[promptIndex] !== "NA" && <p>{hints[promptIndex]}</p>}
          </>
        )}
      </div>
    </div>
  );
}
