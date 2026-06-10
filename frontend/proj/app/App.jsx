import { useEffect, useRef, useState } from "react";
import { allowedWords, mergeWords } from "./words.js";
import { gamePages, promptKeys, clue } from "./prompts.jsx";
import { apiFetch } from "./api.js";
import { getSocket } from "./socket.js";
import { WIN_MESSAGES, LOSE_MESSAGES } from "./messages.js";
import { colorFor } from "./styles.js";
import { useAuth } from "./useAuth.js";
import { useTopAnswers } from "./useTopAnswers.js";
import Menu from "./Menu.jsx";
import GamePage from "./pages/GamePage.jsx";
import ResultsPage from "./pages/ResultsPage.jsx";
import IntroPage from "./pages/IntroPage.jsx";
import AboutPage from "./pages/AboutPage.jsx";
import AccountPage from "./pages/AccountPage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";

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
  const backToReturn = () => setPage(returnPageRef.current || "game");

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
      onAbout={() => {
        setMenuOpen(false);
        setPage("about");
      }}
      onMyAnswers={() => setMenuNote("My answers is coming soon.")}
      onResetProgress={() => {
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
    return <AccountPage menu={menu} setUser={setUser} onDone={backToReturn} />;
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

  if (page === "results") {
    return (
      <ResultsPage
        menu={menu}
        resultMessage={resultMessage}
        resultText={results[promptIndex] || ""}
        onContinue={() => {
          if (promptIndex >= gamePages.length - 1) {
            setPage("intro");
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
      onGoBack={() => {
        setPromptIndex((i) => i - 1);
        setPage("results");
      }}
    />
  );
}

export default App;
