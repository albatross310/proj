import { useEffect, useState } from "react";
import { apiFetch } from "../api.js";
import { gamePages, promptKeys } from "../prompts.jsx";
import { containerStyle, buttonStyle } from "../styles.js";

// Heading for a prompt key; falls back to the raw key for answers whose
// prompt is no longer in the deck.
const headingFor = (key) => {
  const i = promptKeys.indexOf(key);
  return i === -1 ? key : gamePages[i].heading.replace(/\*\*/g, "").trim();
};

// How the AI judge's verdict shows up next to an answer. `ai_verdict` is filled
// in asynchronously, so it may be null (pending) on a freshly-saved answer.
const VERDICT_LABEL = {
  accept: "✓ accepted",
  reject: "✗ rejected",
  unsure: "… under review",
  error: "AI check failed"
};
const VERDICT_COLOR = {
  accept: "#1a7f37",
  reject: "#c0392b",
  unsure: "#9a6700",
  error: "#888"
};
// Friendly name for the model tier that settled the verdict.
const TIER_LABEL = {
  haiku: "Haiku",
  sonnet: "Sonnet",
  opus: "Opus",
  error: null
};

function AiVerdict({ answer }) {
  const verdict = answer.ai_verdict;
  if (!verdict) {
    return <span style={{ color: "#9a6700" }}>… checking</span>;
  }
  const tier = TIER_LABEL[answer.ai_tier];
  const conf =
    verdict === "accept" || verdict === "reject"
      ? answer.ai_confidence != null
        ? ` ${answer.ai_confidence}%`
        : ""
      : "";
  return (
    <span
      style={{ color: VERDICT_COLOR[verdict] || "#888" }}
      title={answer.ai_reason || undefined}
    >
      {VERDICT_LABEL[verdict] || verdict}
      {conf}
      {tier ? ` · ${tier}` : ""}
    </span>
  );
}

// The signed-in user's saved answers, grouped by prompt in deck order.
export default function MyAnswersPage({ menu, user, onBack, onSignIn }) {
  const [answers, setAnswers] = useState(null); // null = loading
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    apiFetch("/api/me/answers", { auth: true })
      .then((data) => {
        if (!cancelled) setAnswers(data.answers);
      })
      .catch((err) => {
        if (!cancelled) {
          setAnswers([]);
          setNote(err.message || "Could not reach the server.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Deck-order groups first, then keys that left the deck (newest-first
  // within each group — the API already sorts that way).
  const groups = [];
  if (answers) {
    const byKey = new Map();
    for (const a of answers) {
      if (!byKey.has(a.prompt_key)) byKey.set(a.prompt_key, []);
      byKey.get(a.prompt_key).push(a);
    }
    for (const key of [...promptKeys, ...byKey.keys()]) {
      if (byKey.has(key)) {
        groups.push({ key, heading: headingFor(key), answers: byKey.get(key) });
        byKey.delete(key);
      }
    }
  }

  return (
    <div style={{ textAlign: "center", marginTop: 100, fontSize: 24 }}>
      <div className="dc-card-page" style={containerStyle}>
        {menu}
        <br />
        <br />
        <h2>My answers</h2>
        {!user ? (
          <>
            <p style={{ fontSize: 16 }}>Sign in to see your saved answers.</p>
            <button className="dc-button" style={buttonStyle} onClick={onSignIn}>
              Sign in
            </button>
          </>
        ) : answers === null ? (
          <p style={{ fontSize: 16, opacity: 0.7 }}>Loading…</p>
        ) : groups.length === 0 ? (
          <p style={{ fontSize: 16 }}>
            {note || "Nothing saved yet — play a prompt and your answers will appear here."}
          </p>
        ) : (
          <div style={{ textAlign: "left", maxWidth: 560, margin: "0 auto" }}>
            {groups.map((g) => (
              <div key={g.key} style={{ marginBottom: 28 }}>
                <h3 style={{ fontSize: 18, marginBottom: 8 }}>{g.heading}</h3>
                {g.answers.map((a) => (
                  <div key={a.id} style={{ fontSize: 16, padding: "6px 0" }}>
                    “{a.answer_text}”
                    <span style={{ fontSize: 13, opacity: 0.65, marginLeft: 10 }}>
                      {a.score} pts
                      {a.all_words_valid ? " · all words valid" : ""}
                      {" · "}
                      {new Date(a.created_at).toLocaleDateString()}
                    </span>
                    <div style={{ fontSize: 13, marginTop: 2 }}>
                      <AiVerdict answer={a} />
                    </div>
                  </div>
                ))}
              </div>
            ))}
            {note && <p style={{ fontSize: 14, opacity: 0.8 }}>{note}</p>}
          </div>
        )}
        <br />
        <button className="dc-button" style={buttonStyle} onClick={onBack}>
          Back
        </button>
      </div>
    </div>
  );
}
