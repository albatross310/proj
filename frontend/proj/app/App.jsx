import { useEffect, useRef, useState } from "react";
import { allowedWords, mergeWords } from "./words.js";
import { gamePages, promptKeys, clue } from "./prompts.jsx";
import { apiFetch } from "./api.js";
import { getSocket } from "./socket.js";
import { WIN_MESSAGES, LOSE_MESSAGES } from "./messages.js";
import { buildJudgePrompt } from "./judgePrompt.js";
import { colorFor, containerStyle, buttonRowStyle, buttonStyle } from "./styles.js";
import { useAuth } from "./useAuth.js";
import { useTopAnswers } from "./useTopAnswers.js";
import Menu from "./Menu.jsx";
import GamePage from "./pages/GamePage.jsx";
import ResultsPage from "./pages/ResultsPage.jsx";
import IntroPage from "./pages/IntroPage.jsx";
import AboutPage from "./pages/AboutPage.jsx";
import AccountPage from "./pages/AccountPage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";
import MyAnswersPage from "./pages/MyAnswersPage.jsx";
import NotificationsPage from "./pages/NotificationsPage.jsx";

const GREEN = "#15803d";
const RED = "#e11d48";

function App() {
  // ── Core game + page state ──────────────────────────────────────────────
  const [text, setText] = useState("");
  const [validated, setValidated] = useState([]); // server-authoritative per-word validity
  const [page, setPage] = useState("game"); // game | intro | results | end | about | account | settings | myanswers
  const [resultMessage, setResultMessage] = useState("");
  const [aiResult, setAiResult] = useState("pending"); // "pending" | {verdict,...} | null
  const [resultStatus, setResultStatus] = useState("pending"); // pending|win|lose|rejected|review
  const [contestNote, setContestNote] = useState("");
  const [submittedAnswerId, setSubmittedAnswerId] = useState(null);
  const [submitError, setSubmitError] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [results, setResults] = useState([]);
  const [promptIndex, setPromptIndex] = useState(0);
  const [introIndex, setIntroIndex] = useState(0);
  const [revealIndex, setRevealIndex] = useState(0);

  const inputRef = useRef(null);
  const menuRef = useRef(null);
  const returnPageRef = useRef("game"); // where to return after account/settings
  const prevPageRef = useRef("game");
  const resultMsgRef = useRef(0); // cycles through the playful result titles
  const tryAgainRef = useRef(false); // retry: skip the reveal, go straight to typing

  // ── Menu + preferences (defaults are deterministic for SSR; stored values
  // applied after mount to avoid a hydration mismatch) ─────────────────────
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuNote, setMenuNote] = useState("");
  const [revealMode, setRevealMode] = useState(true);
  const [hideRevealToggle, setHideRevealToggle] = useState(false);
  const [sortBy, setSortBy] = useState("points");

  // ── Account + social data ────────────────────────────────────────────────
  const { user, setUser, signOut } = useAuth();
  const [answersVersion, setAnswersVersion] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const unreadCount = notifications.filter((n) => !n.read).length;
  const { topAnswers, likeAnswer } = useTopAnswers(
    page,
    promptKeys[promptIndex],
    sortBy,
    answersVersion
  );
  // Poll notifications for signed-in users every 60 s.
  useEffect(() => {
    if (!user) { setNotifications([]); return; }
    const fetch = () =>
      apiFetch("/api/me/notifications", { auth: true })
        .then((d) => setNotifications(d?.notifications || []))
        .catch(() => {});
    fetch();
    const t = setInterval(fetch, 60000);
    return () => clearInterval(t);
  }, [user]);

  const [likeNote, setLikeNote] = useState("");
  const [shareNote, setShareNote] = useState("");

  // ── Derived: tokenise + colour the current text ─────────────────────────
  const tokens = text.match(/[a-z]+|./gi) || [];
  const words = mergeWords(tokens).map((w) => w.toLowerCase());

  // Word tokens prefer the server's verdict (`validated`, which excludes
  // punctuation) so a tampered client can't fake green; punctuation and
  // not-yet-validated words fall back to the local list.
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
    if (submitError) setSubmitError("");
  }, [text]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // ── Load stored preferences after mount ──────────────────────────────────
  useEffect(() => {
    if (localStorage.getItem("dotcomma_reveal") === "off") setRevealMode(false);
    if (localStorage.getItem("dotcomma_hide_reveal_toggle") === "1") {
      setHideRevealToggle(true);
    }
    const storedSort = localStorage.getItem("dotcomma_sort");
    if (storedSort) setSortBy(storedSort);
  }, []);

  // ── Deck progress: a list of completed prompt keys in localStorage. ─────
  const completedKeys = () => {
    try {
      const stored = JSON.parse(localStorage.getItem("dotcomma_progress") || "[]");
      return Array.isArray(stored) ? stored : [];
    } catch {
      return []; // corrupted / unavailable storage — start fresh
    }
  };

  const markCompleted = (key) => {
    try {
      const completed = completedKeys();
      if (!completed.includes(key)) {
        completed.push(key);
        localStorage.setItem("dotcomma_progress", JSON.stringify(completed));
      }
    } catch {
      /* storage unavailable — progress just won't persist */
    }
  };

  // Resume at the first prompt not yet submitted. Runs after mount (like the
  // prefs above) to avoid a hydration mismatch. Keys no longer in the deck
  // are ignored, so removing a prompt can't strand anyone.
  useEffect(() => {
    const next = promptKeys.findIndex((k) => !completedKeys().includes(k));
    if (next === -1) setPage("end");
    else if (next > 0) setPromptIndex(next);
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

    // Block submit when any alphabetic word is off the allowed list.
    const wordList = words.filter((w) => /^[a-z]+$/i.test(w));
    const allGood =
      wordList.length > 0 &&
      wordList.every((w) => allowedWords.has(w.toLowerCase()));

    if (!allGood) {
      setSubmitError("Try to rewrite with green words only.");
      return;
    }

    setResults((prev) => {
      const copy = [...prev];
      copy[promptIndex] = text;
      return copy;
    });
    const pool = allGood ? WIN_MESSAGES : LOSE_MESSAGES;
    setResultMessage(pool[resultMsgRef.current++ % pool.length]);

    setAiResult("pending"); // show "checking…" until the verdict comes back
    setResultStatus("pending"); // headline waits for the combined verdict
    setContestNote("");
    setSubmittedAnswerId(null);
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
      .then((data) => {
        setAnswersVersion((v) => v + 1);
        setAiResult(data?.ai ?? null); // object = verdict, null = unavailable
        setSubmittedAnswerId(data?.answer?.id ?? null);
        // Fall back to the local word-only result if the server didn't send one.
        setResultStatus(data?.status ?? (allGood ? "win" : "lose"));
      })
      .catch((err) => {
        console.error("Could not save answer:", err);
        setAiResult(null);
        setResultStatus(allGood ? "win" : "lose");
      });

    markCompleted(promptKeys[promptIndex]);
    setText("");
    setPage("results");
  };

  // ── Enter submits (game), Backspace retries (results). Subscribed once per
  // page change; submitAnswer is read via a ref so the listener isn't re-bound
  // on every keystroke. ────────────────────────────────────────────────────
  const submitRef = useRef(submitAnswer);
  submitRef.current = submitAnswer;
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Enter" && page === "game") {
        e.preventDefault();
        submitRef.current();
      }
      if (e.key === "Backspace" && page === "results") {
        tryAgainRef.current = true;
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

  // Contest a rejected verdict: ask the backend to e-mail it for human review.
  const onContest = async () => {
    if (!submittedAnswerId) return;
    setContestNote("Sending…");
    try {
      await apiFetch(`/api/answers/${submittedAnswerId}/contest`, { method: "POST" });
      setContestNote("Thanks — we'll take another look at this one. ✓");
    } catch (err) {
      console.error("Could not contest answer:", err);
      setContestNote("Couldn't send that just now — please try again later.");
    }
  };

  const changeSort = (s) => {
    setSortBy(s);
    localStorage.setItem("dotcomma_sort", s);
  };

  const onLike = (answerId) => setLikeNote(likeAnswer(answerId));

  // ── Navigate from the menu, remembering the page to return to ────────────
  const goToPage = (target) => {
    setMenuOpen(false);
    returnPageRef.current = page;
    setPage(target);
  };
  const backToReturn = () => {
    const target = returnPageRef.current || "game";
    returnPageRef.current = "game"; // consume, so Back can't loop to itself
    setPage(target);
  };

  const menu = (
    <Menu
      user={user}
      menuOpen={menuOpen}
      setMenuOpen={setMenuOpen}
      menuNote={menuNote}
      setMenuNote={setMenuNote}
      menuRef={menuRef}
      onSignIn={() => goToPage("account")}
      onSettings={() => goToPage("settings")}
      onMyAnswers={() => goToPage("myanswers")}
      onNotifications={() => goToPage("notifications")}
      unreadCount={unreadCount}
      onResetProgress={() => {
        try {
          localStorage.removeItem("dotcomma_progress");
        } catch {
          /* storage unavailable */
        }
        setResults([]);
        setPromptIndex(0);
        setText("");
        setIntroIndex(0);
        setRevealIndex(0);
        setMenuOpen(false);
        setPage("intro");
      }}
      onSignOut={() => {
        signOut();
        setMenuOpen(false);
      }}
    />
  );

  // ── Render the active page ────────────────────────────────────────────────
  if (page === "settings") {
    return (
      <SettingsPage
        menu={menu}
        user={user}
        setUser={setUser}
        onBack={backToReturn}
        hideRevealToggle={hideRevealToggle}
        setHideRevealToggle={setHideRevealToggle}
      />
    );
  }

  if (page === "account") {
    return <AccountPage menu={menu} onDone={backToReturn} />;
  }

  if (page === "myanswers") {
    return (
      <MyAnswersPage
        menu={menu}
        user={user}
        onBack={backToReturn}
        onSignIn={() => goToPage("account")}
      />
    );
  }

  if (page === "notifications") {
    return (
      <NotificationsPage
        menu={menu}
        notifications={notifications}
        onBack={backToReturn}
        onMarkAllRead={() => {
          apiFetch("/api/me/notifications/read-all", { method: "POST", auth: true }).catch(() => {});
          setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        }}
      />
    );
  }

  if (page === "about") {
    return <AboutPage menu={menu} onBack={() => setPage("intro")} />;
  }

  if (page === "intro") {
    return (
      <IntroPage
        menu={menu}
        introIndex={introIndex}
        setIntroIndex={setIntroIndex}
        onAbout={() => setPage("about")}
        onDone={() => setPage("game")}
      />
    );
  }

  if (page === "end") {
    return (
      <div style={{ textAlign: "center", marginTop: 100, fontSize: 24 }}>
        <div className="dc-card-page" style={containerStyle}>
          {menu}
          <h2>
            <br /><br />That&apos;s the whole deck — for now.
          </h2>
          <p style={{ fontSize: 20 }}>New prompts are on the way.</p>
          <div style={buttonRowStyle}>
            <button
              className="dc-button"
              style={buttonStyle}
              onClick={() => {
                try {
                  localStorage.removeItem("dotcomma_progress");
                } catch {
                  /* storage unavailable */
                }
                setResults([]);
                setPromptIndex(0);
                setText("");
                setRevealIndex(0);
                setPage("game");
              }}
            >
              Play again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (page === "results") {
    return (
      <ResultsPage
        menu={menu}
        resultMessage={resultMessage}
        aiResult={aiResult}
        resultStatus={resultStatus}
        onContest={onContest}
        contestNote={contestNote}
        judgePrompt={buildJudgePrompt(promptIndex, results[promptIndex] || "")}
        resultText={results[promptIndex] || ""}
        onContinue={() => {
          if (promptIndex >= gamePages.length - 1) {
            setPage("end");
          } else {
            setPromptIndex((i) => i + 1);
            setRevealIndex(0);
            setText("");
            setPage("game");
          }
        }}
        onTryAgain={() => {
          tryAgainRef.current = true;
          setPage("game");
        }}
        onShare={shareAnswer}
        shareNote={shareNote}
        topAnswers={topAnswers}
        sortBy={sortBy}
        onSort={changeSort}
        likeNote={likeNote}
        onLike={onLike}
      />
    );
  }

  return (
    <GamePage
      menu={menu}
      promptIndex={promptIndex}
      revealMode={revealMode}
      setRevealMode={setRevealMode}
      hideRevealToggle={hideRevealToggle}
      revealIndex={revealIndex}
      setRevealIndex={setRevealIndex}
      isTyping={isTyping}
      setIsTyping={setIsTyping}
      text={text}
      setText={setText}
      words={words}
      wordColors={wordColors}
      inputRef={inputRef}
      onSubmit={submitAnswer}
      submitError={submitError}
      onGoBack={() => {
        setPromptIndex((i) => i - 1);
        setPage("results");
      }}
    />
  );
}

export default App;
