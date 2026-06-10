import { useEffect, useRef, useState } from "react";
import { allowedWords, mergeWords } from "./words.js";
import { aboutDotComma, introPages } from "./about.jsx";
import LogoMark from "./LogoMark.jsx";
import {
  gamePages,
  promptKeys,
  headings,
  prompts,
  clue,
  hints,
  renderFormatted
} from "./prompts.jsx";
import { apiFetch, setToken } from "./api.js";
import { getSocket } from "./socket.js";
import { WIN_MESSAGES, LOSE_MESSAGES, formatSubmitted } from "./messages.js";
import {
  containerStyle,
  boxStyle,
  buttonRowStyle,
  buttonStyle,
  menuItemStyle,
  authInputStyle,
  colorFor
} from "./styles.js";
import { useAuth } from "./useAuth.js";
import { useTopAnswers } from "./useTopAnswers.js";

const GREEN = "#15803d";
const RED = "#e11d48";

function App() {
  // ── Core game + page state ──────────────────────────────────────────────
  const [text, setText] = useState("");
  const [validated, setValidated] = useState([]); // server-authoritative per-word validity
  const [page, setPage] = useState("game"); // game | intro | results | about | account | settings
  const [resultMessage, setResultMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [results, setResults] = useState([]);
  const [promptIndex, setPromptIndex] = useState(0);
  const [introIndex, setIntroIndex] = useState(0);
  const [revealIndex, setRevealIndex] = useState(0);

  const inputRef = useRef(null);
  const menuRef = useRef(null);
  const returnPageRef = useRef("game"); // where to go back to after account/settings
  const prevPageRef = useRef("game");
  const resultMsgRef = useRef(0); // cycles through the playful result titles
  const tryAgainRef = useRef(false); // retry: skip the reveal, go straight to typing

  // ── Menu ────────────────────────────────────────────────────────────────
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuNote, setMenuNote] = useState("");

  // ── Account (sign in / sign up / forgot password) ───────────────────────
  const { user, setUser, signOut } = useAuth();
  const [authMode, setAuthMode] = useState("password"); // password | forgot | reset
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [authError, setAuthError] = useState("");
  const [authNote, setAuthNote] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [settingsNote, setSettingsNote] = useState("");

  // ── Preferences (default deterministically for SSR; stored values applied
  // in an effect after mount, to avoid a hydration mismatch) ───────────────
  const [revealMode, setRevealMode] = useState(true);
  const [hideRevealToggle, setHideRevealToggle] = useState(false);
  const [sortBy, setSortBy] = useState("points");

  // ── Results / social ────────────────────────────────────────────────────
  const [answersVersion, setAnswersVersion] = useState(0);
  const { topAnswers, likeAnswer } = useTopAnswers(
    page,
    promptKeys[promptIndex],
    sortBy,
    answersVersion
  );
  const [likeNote, setLikeNote] = useState("");
  const [shareNote, setShareNote] = useState("");

  // ── Derived: tokenise + colour the current text ─────────────────────────
  const tokens = text.match(/[a-z]+|./gi) || [];
  const words = mergeWords(tokens).map((w) => w.toLowerCase());

  // Colour each rendered token. Word tokens prefer the server's verdict
  // (`validated`, which excludes punctuation) so a tampered client can't fake
  // green; punctuation and not-yet-validated words fall back to the local list.
  const wordColors = (() => {
    let vi = 0;
    return words.map((t) => {
      if (/^[a-z]+$/i.test(t)) {
        const v = validated[vi++];
        if (v && v.word === t.toLowerCase()) return v.valid ? GREEN : RED;
      }
      return colorFor(t, allowedWords);
    });
  })();

  // ── Live validation: debounce the text to the server, receive verdicts ───
  const debounceRef = useRef(null);
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      getSocket()?.emit("validate_text", text);
    }, 100);
  }, [text]);

  useEffect(() => {
    const s = getSocket();
    if (!s) return;
    s.on("validation_result", (data) => setValidated(data));
    return () => s.off("validation_result");
  }, []);

  // ── Restart the reveal only when arriving from a round boundary
  // (results/intro). Returning from account/settings keeps progress; a retry
  // of the same prompt skips the reveal entirely. ─────────────────────────
  useEffect(() => {
    const from = prevPageRef.current;
    prevPageRef.current = page;
    if (page === "game" && (from === "results" || from === "intro")) {
      if (tryAgainRef.current) {
        // Jump past the last stage so the typing box shows immediately.
        const introCount = gamePages[promptIndex].intro.length;
        const hasClueNow = clue[promptIndex] && clue[promptIndex] !== "NA";
        setRevealIndex(introCount + 1 + (hasClueNow ? 1 : 0) + 1);
      } else {
        setRevealIndex(0);
      }
      tryAgainRef.current = false;
      setIsTyping(false); // stale isTyping blocked click-to-reveal
    }
  }, [page, promptIndex]);

  // ── Load stored preferences after mount (keeps SSR/first render stable) ──
  useEffect(() => {
    if (localStorage.getItem("dotcomma_reveal") === "off") setRevealMode(false);
    if (localStorage.getItem("dotcomma_hide_reveal_toggle") === "1") {
      setHideRevealToggle(true);
    }
    const storedSort = localStorage.getItem("dotcomma_sort");
    if (storedSort) setSortBy(storedSort);
  }, []);

  // ── Close the menu on click away (capture phase, so the click doesn't also
  // advance the game). Clicks inside the menu pass through to its items. ───
  useEffect(() => {
    if (!menuOpen) return;
    const close = (e) => {
      if (menuRef.current && menuRef.current.contains(e.target)) return;
      e.stopPropagation();
      setMenuOpen(false);
    };
    window.addEventListener("click", close, true);
    return () => window.removeEventListener("click", close, true);
  }, [menuOpen]);

  // ── Focus the hidden textarea as soon as the typing area is revealed ─────
  useEffect(() => {
    if (page === "game") inputRef.current?.focus();
  }, [page, revealIndex, promptIndex]);

  // ── Submit the current answer ────────────────────────────────────────────
  const submitAnswer = () => {
    if (!text.trim()) return;

    setResults((prev) => {
      const copy = [...prev];
      copy[promptIndex] = text;
      return copy;
    });

    // Local validation for the immediate fallback title; the backend recomputes
    // authoritatively and chooses the rotating message.
    const wordList = words.filter((w) => /^[a-z]+$/i.test(w));
    const allGood =
      wordList.length > 0 &&
      wordList.every((w) => allowedWords.has(w.toLowerCase()));
    const pool = allGood ? WIN_MESSAGES : LOSE_MESSAGES;
    setResultMessage(pool[resultMsgRef.current++ % pool.length]);

    // Persist + refresh the top answers (now includes this one). Sends the
    // session token when signed in so the answer links to the user.
    apiFetch("/api/answers", {
      method: "POST",
      auth: true,
      body: {
        promptKey: promptKeys[promptIndex],
        answerText: text,
        visibility: "public",
        winCount: WIN_MESSAGES.length,
        loseCount: LOSE_MESSAGES.length
      }
    })
      .then(() => setAnswersVersion((v) => v + 1))
      .catch((err) => console.error("Could not save answer:", err));

    setText("");
    setPage("results");
  };

  // ── Enter submits (on game), Backspace retries (on results). Subscribed
  // once per page change — submitAnswer is read via a ref so the listener
  // isn't re-bound on every keystroke. ────────────────────────────────────
  const submitRef = useRef(submitAnswer);
  submitRef.current = submitAnswer;
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Enter" && page === "game") {
        e.preventDefault();
        submitRef.current();
      }
      if (e.key === "Backspace" && page === "results") {
        tryAgainRef.current = true; // back to the same prompt, already revealed
        setPage("game");
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [page]);

  // ── Share / sort / like ──────────────────────────────────────────────────
  const shareAnswer = async () => {
    const answer = results[promptIndex] || "";
    const url = "https://dotcomma.com.au";
    const shareText =
      `I wrote "${answer}" on DotComma — a word game about saying more ` +
      `with short, plain words.`;
    setShareNote("");
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "DotComma", text: shareText, url });
      } catch {
        /* user cancelled — ignore */
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(`${shareText} ${url}`);
      setShareNote("Copied! Paste it anywhere to share.");
    } catch {
      setShareNote("Share dotcomma.com.au with a friend!");
    }
  };

  const changeSort = (s) => {
    setSortBy(s);
    localStorage.setItem("dotcomma_sort", s);
  };

  const onLike = (answerId) => setLikeNote(likeAnswer(answerId));

  // ── Menu (top-right ☰ on every page) ─────────────────────────────────────
  // Navigate from the menu, remembering the current page so account/settings
  // can return to it.
  const goToPage = (target) => {
    setMenuOpen(false);
    returnPageRef.current = page;
    setPage(target);
  };

  const renderMenu = () => (
    <div
      ref={menuRef}
      onClick={(e) => e.stopPropagation()}
      style={{ position: "absolute", top: 10, right: 10, textAlign: "right", zIndex: 10 }}
    >
      <button
        aria-label="Menu"
        onClick={() => {
          setMenuOpen((o) => !o);
          setMenuNote("");
        }}
        style={{ fontSize: 22, background: "none", border: "none", cursor: "pointer" }}
      >
        ☰
      </button>
      {menuOpen && (
        <div className="dc-menu-panel" style={{ textAlign: "left", minWidth: 190 }}>
          {user ? (
            <div style={{ ...menuItemStyle, cursor: "default", opacity: 0.7, fontSize: 14 }}>
              Signed in as <b>{user.displayName}</b>
            </div>
          ) : (
            <div
              className="dc-menu-item"
              style={menuItemStyle}
              onClick={() => {
                setAuthMode("password");
                setAuthError("");
                setAuthNote("");
                setAuthPassword("");
                goToPage("account");
              }}
            >
              Sign in
            </div>
          )}
          <div
            className="dc-menu-item"
            style={menuItemStyle}
            onClick={() => {
              setNameDraft(user ? user.displayName : "");
              setSettingsNote("");
              goToPage("settings");
            }}
          >
            Settings
          </div>
          <div
            className="dc-menu-item"
            style={menuItemStyle}
            onClick={() => {
              setMenuOpen(false);
              setPage("about");
            }}
          >
            About DotComma
          </div>
          <div
            className="dc-menu-item"
            style={menuItemStyle}
            onClick={() => setMenuNote("My answers is coming soon.")}
          >
            My answers
          </div>
          <div
            className="dc-menu-item"
            style={menuItemStyle}
            onClick={() => {
              setResults([]);
              setPromptIndex(0);
              setText("");
              setIntroIndex(0);
              setRevealIndex(0);
              setMenuOpen(false);
              setPage("intro");
            }}
          >
            Reset local progress
          </div>
          {user && (
            <div
              className="dc-menu-item"
              style={menuItemStyle}
              onClick={() => {
                signOut();
                setMenuOpen(false);
              }}
            >
              Sign out
            </div>
          )}
          {menuNote && (
            <p style={{ fontSize: 13, opacity: 0.6, padding: "0 14px 8px", margin: 0 }}>
              {menuNote}
            </p>
          )}
        </div>
      )}
    </div>
  );

  // ── SETTINGS PAGE ─────────────────────────────────────────────────────────
  if (page === "settings") {
    const saveName = async (e) => {
      e.preventDefault();
      setSettingsNote("");
      try {
        const data = await apiFetch("/api/me/display-name", {
          method: "POST",
          auth: true,
          body: { displayName: nameDraft }
        });
        setUser(data.user);
        setSettingsNote("Saved!");
      } catch (err) {
        setSettingsNote(err.message || "Could not reach the server.");
      }
    };
    return (
      <div style={{ textAlign: "center", marginTop: 100, fontSize: 24 }}>
        <div className="dc-card-page" style={containerStyle}>
          {renderMenu()}
          <br /><br />
          <h2>Settings</h2>
          {user ? (
            <form onSubmit={saveName}>
              <p style={{ fontSize: 16 }}>
                Display name — shown next to your public answers.
              </p>
              <input
                className="dc-input"
                value={nameDraft}
                maxLength={30}
                onChange={(e) => setNameDraft(e.target.value)}
                style={{ fontSize: 18, padding: "8px 12px", textAlign: "center", width: 260, margin: "10px 0" }}
              />
              <br />
              <button type="submit" className="dc-button" style={buttonStyle}>
                Save
              </button>
            </form>
          ) : (
            <p style={{ fontSize: 16 }}>Sign in to change your display name.</p>
          )}
          {settingsNote && <p style={{ fontSize: 14, opacity: 0.8 }}>{settingsNote}</p>}
          <br />
          <label className="dc-switch" style={{ fontSize: 15 }}>
            <input
              type="checkbox"
              checked={!hideRevealToggle}
              onChange={(e) => {
                const show = e.target.checked;
                setHideRevealToggle(!show);
                localStorage.setItem("dotcomma_hide_reveal_toggle", show ? "" : "1");
              }}
            />
            <span className="track" />
            Show the Progressive Reveal switch on game pages
          </label>
          <br /><br />
          <button
            className="dc-button"
            style={buttonStyle}
            onClick={() => setPage(returnPageRef.current || "game")}
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  // ── ACCOUNT / SIGN-IN PAGE (password, with forgot-password flow) ──────────
  if (page === "account") {
    const back = () => setPage(returnPageRef.current || "game");

    // Email + password: signs up, logs in, or sets a password on a legacy account.
    const submitPassword = async (e) => {
      e.preventDefault();
      setAuthError("");
      try {
        const data = await apiFetch("/api/auth/password", {
          method: "POST",
          body: { email: authEmail, password: authPassword }
        });
        setToken(data.token);
        setUser(data.user);
        setAuthPassword("");
        back();
      } catch (err) {
        setAuthError(err.message || "Could not reach the server.");
      }
    };

    // Forgot password: request a reset code by email.
    const submitForgotStart = async (e) => {
      e.preventDefault();
      setAuthError("");
      setAuthNote("");
      try {
        await apiFetch("/api/auth/forgot/start", {
          method: "POST",
          body: { email: authEmail }
        });
        setResetCode("");
        setAuthPassword("");
        setAuthMode("reset");
        setAuthNote("If that email has an account, a reset code is on its way.");
      } catch (err) {
        setAuthError(err.message || "Could not reach the server.");
      }
    };

    // Forgot password: set a new password using the emailed code.
    const submitForgotReset = async (e) => {
      e.preventDefault();
      setAuthError("");
      try {
        const data = await apiFetch("/api/auth/forgot/reset", {
          method: "POST",
          body: { email: authEmail, code: resetCode, password: authPassword }
        });
        setToken(data.token);
        setUser(data.user);
        setAuthPassword("");
        setResetCode("");
        back();
      } catch (err) {
        setAuthError(err.message || "Could not reach the server.");
      }
    };

    return (
      <div style={{ textAlign: "center", marginTop: 100, fontSize: 24 }}>
        <div className="dc-card-page" style={containerStyle}>
          {renderMenu()}
          <br /><br />
          <h2>{authMode === "password" ? "Sign in" : "Reset password"}</h2>

          {authMode === "password" && (
            <form onSubmit={submitPassword}>
              <p style={{ fontSize: 16 }}>
                New here? Just pick a password to create your account.
              </p>
              <input
                type="email"
                autoFocus
                className="dc-input"
                placeholder="you@example.com"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                style={authInputStyle}
              />
              <br />
              <input
                type="password"
                className="dc-input"
                placeholder="password"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                style={authInputStyle}
              />
              <br />
              <button type="submit" className="dc-button" style={buttonStyle}>
                Sign in
              </button>
              <p style={{ fontSize: 14, marginTop: 14 }}>
                <span
                  className="dc-about-link"
                  onClick={() => {
                    setAuthError("");
                    setAuthNote("");
                    setAuthMode("forgot");
                  }}
                >
                  Forgot your password?
                </span>
              </p>
            </form>
          )}

          {authMode === "forgot" && (
            <form onSubmit={submitForgotStart}>
              <p style={{ fontSize: 16 }}>
                Enter your email and we'll send you a reset code.
              </p>
              <input
                type="email"
                autoFocus
                className="dc-input"
                placeholder="you@example.com"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                style={authInputStyle}
              />
              <br />
              <button type="submit" className="dc-button" style={buttonStyle}>
                Send code
              </button>
              <p style={{ fontSize: 14, marginTop: 14 }}>
                <span className="dc-about-link" onClick={() => setAuthMode("password")}>
                  Back to sign in
                </span>
              </p>
            </form>
          )}

          {authMode === "reset" && (
            <form onSubmit={submitForgotReset}>
              <p style={{ fontSize: 16 }}>
                Enter the code from your email and a new password.
              </p>
              <input
                type="text"
                autoFocus
                inputMode="numeric"
                className="dc-input"
                placeholder="6-digit code"
                value={resetCode}
                onChange={(e) => setResetCode(e.target.value)}
                style={authInputStyle}
              />
              <br />
              <input
                type="password"
                className="dc-input"
                placeholder="new password"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                style={authInputStyle}
              />
              <br />
              <button type="submit" className="dc-button" style={buttonStyle}>
                Set new password
              </button>
              <p style={{ fontSize: 14, marginTop: 14 }}>
                <span className="dc-about-link" onClick={() => setAuthMode("forgot")}>
                  Resend code
                </span>
              </p>
            </form>
          )}

          {authNote && <p style={{ fontSize: 14, opacity: 0.8 }}>{authNote}</p>}
          {authError && <p style={{ color: "red", fontSize: 14 }}>{authError}</p>}
          <br />
          <button className="dc-button" style={buttonStyle} onClick={back}>
            Back
          </button>
        </div>
      </div>
    );
  }

  // ── ABOUT PAGE ────────────────────────────────────────────────────────────
  if (page === "about") {
    // \n marks paragraph breaks in the source; HTML collapses raw newlines,
    // so split into real <p> elements here.
    const aboutParagraphs = aboutDotComma
      .split(/\n\s*\n/)
      .map((p) => p.replace(/\s+/g, " ").trim())
      .filter(Boolean);
    return (
      <div className="dc-card-page" style={containerStyle}>
        {renderMenu()}
        <br /><br />
        <h2>About DotComma</h2>
        <br />
        <div style={{ textAlign: "left" }}>
          {aboutParagraphs.map((p, i) => (
            <p key={i} style={{ marginBottom: 16 }}>{p}</p>
          ))}
        </div>
        <br />
        <button className="dc-button" style={buttonStyle} onClick={() => setPage("intro")}>
          Back
        </button>
        <br /><br />
      </div>
    );
  }

  // ── INTRO PAGE ────────────────────────────────────────────────────────────
  if (page === "intro") {
    return (
      <div
        onClick={() => {
          if (introIndex < introPages.length) {
            setIntroIndex((i) => i + 1);
          } else {
            setPage("game");
          }
        }}
        style={{ textAlign: "center", marginTop: 100, fontSize: 24, cursor: "pointer" }}
      >
        <div className="dc-card-page" style={containerStyle}>
          {renderMenu()}
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
                setPage("about");
              }}
            >
              About
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ── RESULTS PAGE ──────────────────────────────────────────────────────────
  if (page === "results") {
    const resultText = results[promptIndex] || "";
    const resultTokens = resultText.match(/[a-z]+|./gi) || [];
    const resultWords = mergeWords(resultTokens);
    return (
      <div style={{ textAlign: "center", marginTop: 100, fontSize: 24 }}>
        <div className="dc-card-page" style={containerStyle}>
          {renderMenu()}
          <h2 style={{ fontSize: 24, minHeight: 200 }}>
            <br /><br />{resultMessage}
          </h2>
          <div className="dc-typebox" style={{ ...boxStyle, margin: "30px 0" }}>
            {resultWords.map((t, i) => (
              <span key={i} style={{ color: colorFor(t, allowedWords), marginRight: 4 }}>
                {t}
              </span>
            ))}
          </div>
          <button
            className="dc-button"
            style={buttonStyle}
            onClick={() => {
              if (promptIndex >= prompts.length - 1) {
                setPage("intro");
              } else {
                setPromptIndex((i) => i + 1);
                setRevealIndex(0);
                setText("");
                setPage("game");
              }
            }}
          >
            Continue
          </button>
          <button
            className="dc-button"
            style={buttonStyle}
            onClick={() => {
              tryAgainRef.current = true; // same prompt, skip the reveal
              setPage("game");
            }}
          >
            Try Again
          </button>
          <button className="dc-button" style={buttonStyle} onClick={shareAnswer}>
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
                    onClick={() => changeSort("points")}
                  >
                    Points
                  </button>{" "}
                  <button
                    className={`dc-chip${sortBy === "recent" ? " dc-chip-active" : ""}`}
                    onClick={() => changeSort("recent")}
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

  // ── GAME PAGE ─────────────────────────────────────────────────────────────
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
        {renderMenu()}
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
              <button className="dc-button" style={buttonStyle} onClick={submitAnswer}>
                Enter
              </button>
              {promptIndex > 0 && (
                <button
                  className="dc-button"
                  style={buttonStyle}
                  onClick={() => {
                    setPromptIndex((i) => i - 1);
                    setPage("results");
                  }}
                >
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

export default App;
