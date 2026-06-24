import { allowedWords, mergeWords } from "../words.js";
import { formatSubmitted } from "../messages.js";
import { containerStyle, boxStyle, buttonStyle, colorFor } from "../styles.js";

// The headline above the answer, driven by the combined result status:
//   pending  — verdict not back yet
//   win      — words valid AND the AI accepts the meaning (playful win title)
//   lose     — words off-list (playful lose title)
//   rejected — words valid but the AI says the meaning is wrong
//   review   — words valid, AI unsure; a human / Opus will confirm shortly
function headline(resultStatus, resultMessage) {
  switch (resultStatus) {
    case "pending":
      return { text: "Checking your answer…", color: "inherit", opacity: 0.6 };
    case "rejected":
      return { text: "Not quite — that's not what the line means.", color: "#c0392b" };
    case "review":
      return { text: "Close call — we'll confirm this one shortly.", color: "#9a6700" };
    case "lose":
    case "win":
    default:
      return { text: resultMessage, color: "inherit" };
  }
}

export default function ResultsPage({
  menu,
  resultMessage,
  aiResult,
  resultStatus,
  onContest,
  contestNote,
  resultText,
  onContinue,
  onTryAgain,
  onShare,
  shareNote,
  topAnswers,
  sortBy,
  onSort,
  likeNote,
  onLike
}) {
  const resultWords = mergeWords(resultText.match(/[a-z]+|./gi) || []);
  const h = headline(resultStatus, resultMessage);
  const reason = aiResult && typeof aiResult === "object" ? aiResult.reason : null;

  return (
    <div style={{ textAlign: "center", marginTop: 100, fontSize: 24 }}>
      <div className="dc-card-page" style={containerStyle}>
        {menu}
        <h2 style={{ fontSize: 24, minHeight: 200, color: h.color, opacity: h.opacity }}>
          <br /><br />{h.text}
        </h2>
        <div className="dc-typebox" style={{ ...boxStyle, margin: "30px 0" }}>
          {resultWords.map((t, i) => (
            <span key={i} style={{ color: colorFor(t, allowedWords), marginRight: 4 }}>
              {t}
            </span>
          ))}
        </div>
        {resultStatus === "rejected" && (
          <div style={{ margin: "0 0 18px" }}>
            {reason && (
              <p style={{ fontSize: 15, opacity: 0.75, marginBottom: 10 }}>{reason}</p>
            )}
            {contestNote ? (
              <p style={{ fontSize: 15, color: "#1a7f37" }}>{contestNote}</p>
            ) : (
              <button className="dc-button" style={buttonStyle} onClick={onContest}>
                Contest
              </button>
            )}
          </div>
        )}
        <button className="dc-button" style={buttonStyle} onClick={onContinue}>
          Continue
        </button>
        <button className="dc-button" style={buttonStyle} onClick={onTryAgain}>
          Try Again
        </button>
        <button className="dc-button" style={buttonStyle} onClick={onShare}>
          Share
        </button>
        {shareNote && (
          <p style={{ fontSize: 13, opacity: 0.7, marginTop: 10 }}>{shareNote}</p>
        )}
        {topAnswers.length > 0 && (
          <div style={{ textAlign: "left", fontSize: 16, margin: "30px 0" }}>
            <div
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}
            >
              <p style={{ opacity: 0.7 }}>Other players wrote:</p>
              <span>
                <button
                  className={`dc-chip${sortBy === "points" ? " dc-chip-active" : ""}`}
                  onClick={() => onSort("points")}
                >
                  Points
                </button>{" "}
                <button
                  className={`dc-chip${sortBy === "recent" ? " dc-chip-active" : ""}`}
                  onClick={() => onSort("recent")}
                >
                  Most recent
                </button>
              </span>
            </div>
            {likeNote && (
              <p style={{ fontSize: 13, opacity: 0.7, marginBottom: 8 }}>{likeNote}</p>
            )}
            {topAnswers.map((a) => (
              <div key={a.id} className="dc-answer-card" style={{ padding: "10px 14px", marginBottom: 10 }}>
                <div>“{a.answer_text}”</div>
                <div
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}
                >
                  <span style={{ fontSize: 13, opacity: 0.6 }}>
                    {a.anonymous_name}
                    {" · "}
                    {a.all_words_valid ? "all words valid" : "some words off-list"}
                    {" · "}
                    {a.score} pts
                    {" · "}
                    {formatSubmitted(a.created_at)}
                  </span>
                  <button
                    className="dc-like"
                    onClick={() => onLike(a.id)}
                    aria-label={a.likedByMe ? "Unlike" : "Like"}
                  >
                    {a.likedByMe ? "♥" : "♡"} {a.likes}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
