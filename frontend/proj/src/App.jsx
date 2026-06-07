import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { useRef } from "react";
import "./App.css";

const API_URL = import.meta.env.DEV
  ? "http://localhost:3000"
  : "https://proj-1o7w.onrender.com";

const socket = io(API_URL);const merges = [
  ["be", "ing", "being"],
  ["see", "ing", "seeing"]
];
const baseWords = new Set([
  // pronouns
  "i","you","we","they","he","she","it","me","him","her","us","them",
  // verbs (strict monosyllable base forms)
  "be","do","have","go","see","say","make","take","get","give","find",
  "think","know","want","try","use","work","call","ask","need","feel",
  "leave","put","keep","let","help","talk","turn","start","show","hear",
  "play","run","move","live","hold","bring","write","read","sit","stand",
  "lose","pay","meet","set","learn","change","lead","watch","stop","add",
  "spend","grow","open","walk","win","wait","serve","die","send","build",
  "stay","fall","cut","reach","rise","drive","break","choose","draw",
  "drink","fight","fly","hide","ride","shake","shoot","sing","sink",
  "sleep","slide","speak","steal","stick","swim","swing","teach","throw",
  "wake","wear","weigh","wind","wrap","burn","burst","cast","catch",
  "climb","count","creep","deal","dig","dive","feed","fight","fill",
  "fold","grip","hang","hit","hold","hunt","jump","kick","knit","lift",
  "lock","march","mark","mix","pack","plant","press","pull","push",
  "ring","roll","rub","rush","score","serve","shut","slam","slide",
  "smash","spin","split","spot","spray","stack","step","stir","stretch",
  "strike","sweep","switch","tend","test","track","trade","trust","twist",
  // prepositions
  "in", "on", "with", "at",
  // language-related nouns
  "word","text","line","name","term","sign","sound","tone","mark","form",
  "type","code","rule","set","list","note","voice","speech","talk","chat",
  "box", "purple",
  // general nouns
  "time","day","year","way","man","world","life","hand","part","child","eye",
  "place","work","week","case","point","group","fact","home","room","side",
  "kind","head","house","friend","power","hour","game","end","law","car",
  "city","team","name","road","tree","rock","wind","fire","rain","snow",
  "sun","moon","star","sky","sea","land","hill","field","farm","plant",
  "leaf","root","bird","fish","dog","cat","horse","cow","sheep","pig",
  // numbers (strict monosyllable)
  "one","two","three","four","five","six","seven","eight","nine","ten",
  // modifiers
  "good","bad","big","small","long","short","high","low","fast","slow",
  "new","old","young","rich","poor","strong","weak","hard","soft","dark","light"
]);
const allowedWords = new Set([
  ...baseWords,
  ...merges.map(([, , combined]) => combined)
])
function mergeWords(tokens) {
  const result = [];

  for (let i = 0; i < tokens.length; i++) {
    let merged = false;

    for (const [a, b, combined] of merges) {
      if (
        tokens[i] === a &&
        tokens[i + 1] === " " &&
        tokens[i + 2] === b
      ) {
        result.push(combined);
        i += 2;
        merged = true;
        break;
      }
    }

    if (!merged) result.push(tokens[i]);
  }

  return result;
}

const aboutDotComma = 
  `DotComma aims for nothing less than what modern banking and cryptocurrency has 
  already achieved for years. To contribute to universal human language using 
  technology. In many ways currency is the original human language. Currency began 
  with trade, with giving your daughter a lamb, or a seed. It is the language most
  firmly rooted in the ground--the home of potatoes, of silver, and of seed. (The other 
  universal language rooted in physicality and the earth is arguably power, but we won't 
  go there for now.)\n
  Money took on a state wide form when technology granted us the modern bank.
  More recently, technology has afforded money a more universal 
  form, in the likes of cryptocurrency.  \n
  The same story goes for the two most heavenly forms of language. The languages
  of mathematics and of art. This unlikely duo would at first seem far apart, but have 
  become paradoxically intertwined the more they have become universal. This unlikely 
  relationship was born in it's more modern form in the geometry and geometrically precise 
  artifices made popular in classical times,
  be it with the Greeks, Arabians, Chinese or classical-era South Americans, and later, in these 
  traditions respective Modern resurgences.\n
  Contrary to money, which has its first roots in the earth, the primordial harkings
  of maths and art come from the sky. For maths, this came in the language of 
  astrology and astronomy, with its angles, orbits, calendars and predictions. For art,
  it came first in the stories we told about the stars, planets, weather, and clouds. 
  In both cases the developments
  were vastly mediated by technology, whether it be brushes, rulers, protractors,
  or the Klavier.\n
  Both Money then, and Artifico-Mathemathics (or A/M, as we might refer to it), have 
  been firmly established as universal "word games," and that through technology.
  But what of ordinary language, the branches and twigs, the rain droplets and sun rays,
  that span between. 


  `
const introPages = [
  <>DotComma is a <b>language game</b>. <br /><br /></>,
  <>Players solve lines in <b>short words</b>. <br /><br /> </>,
  <>DotComma helps thinkers <b>write with zest</b>.<br /><br /> </>,
  <>Its goal is to build a <b>shared language</b>.<br /><br /> </>,
  <>Day 1 teaches the basic moves.<br /><br /></>,
  <>
    <span className="dc-hint" style = {{fontSize: 16}}>
      CLICK ANYWHERE TO CONTINUE
    </span>
</>
];
const script = `
HEADING | INTRO | PROMPT | CLUE | CORRECT | ANSWERS | HINT
---
Rule 1: Be simple! | 
Rewrite the following line in **short**, plain words.|
"I try write this line with not-long words." | 
Clue:  I t__ __ ___t_ ___ l___ _n ___r_ ___d_. |
I try write to write the line in short words |
I try write to write the line in short words |
NA
---
`;

function parseScript(script) {
  return script
    .split("---")
    .map(row => row.trim())
    .filter(row => row && !row.startsWith("HEADING"))
    .map(row => {
    const [heading, intro, prompt, clue, correct, answers, hint] = row
      .split("|")
      .map(cell => cell.trim());

    return {
      heading: heading + "\n",
      intro: intro
        .split("\n")
        .map(x => x.trim())
        .filter(Boolean),      prompt: prompt + "\n",
      clue,
      correct,
      answers: answers ? answers.split(";").map(a => 
        a.trim()).filter(Boolean) : [],
      hint
    };
  });
}

// "2026-06-07 16:10:24" (UTC from SQLite) -> "07/06/26 7pm" in local time
function formatSubmitted(createdAt) {
  if (!createdAt) return "";
  const d = new Date(createdAt.replace(" ", "T") + "Z");
  if (isNaN(d)) return "";
  let h = d.getHours();
  if (d.getMinutes() >= 30) h = (h + 1) % 24; // nearest hour
  const ampm = h >= 12 ? "pm" : "am";
  const hr = h % 12 || 12;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy} ${hr}${ampm}`;
}

function renderFormatted(script) {
  return script.split("\n").map((line, i) => (
    <span key={i}>
      {line.split(/(\*\*.*?\*\*)/g).map((part, j) =>
        part.startsWith("**") && part.endsWith("**")
          ? <b key={j}>{part.slice(2, -2)}</b>
          : part
      )}
      <br />
    </span>
  ));
}
const gamePages = parseScript(script);
// Stable key per prompt, e.g. "Rule 1: Be simple!" -> "rule-1-be-simple"
const promptKeys = gamePages.map(p =>
  p.heading
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
);
const headings = gamePages.map(p => renderFormatted(p.heading));
const prompts = gamePages.map(p => renderFormatted(p.prompt));
const clue = gamePages.map(p => p.clue);
const correctAnswers = gamePages.map(p => p.correct);
const hints = gamePages.map(p => p.hint);
const answers = gamePages.map(p => p.answers);


function App() {

//MAIN FUNCTION HOOKS
const [text, setText] = useState("");
const [validated, setValidated] = useState([]); 
// const tokens = text.match(/[a-z]+|./gi) || [];
// const words = mergeWords(tokens).map(w => w.toLowerCase());
const [submitted, setSubmitted] = useState([]);
const [page, setPage] = useState("game"); // intro, game, , results, about
const [resultMessage, setResultMessage] = useState("");
const inputRef = useRef(null);
const menuRef = useRef(null);
const [isTyping, setIsTyping] = useState(false);
const [results, setResults] = useState([]);
const [menuOpen, setMenuOpen] = useState(false);
const [menuNote, setMenuNote] = useState("");
//ACCOUNT STATE (spec Phase 2)
const [user, setUser] = useState(null); // null = not signed in
const [authStep, setAuthStep] = useState("email"); // email | code
const [authEmail, setAuthEmail] = useState("");
const [authCode, setAuthCode] = useState("");
const [authError, setAuthError] = useState("");
const [nameDraft, setNameDraft] = useState("");
const [settingsNote, setSettingsNote] = useState("");
const [topAnswers, setTopAnswers] = useState([]);
const [answersVersion, setAnswersVersion] = useState(0);
// Sort choice persists across pages (app-level state) and reloads (localStorage)
const [sortBy, setSortBy] = useState(
  () => localStorage.getItem("dotcomma_sort") || "points"
);
const [likeNote, setLikeNote] = useState("");
const [promptIndex, setPromptIndex] = useState(0);
const [introIndex, setIntroIndex] = useState(0);
const [revealIndex, setRevealIndex] = useState(0);
const resultText = results[promptIndex] || "";
const tokens = text.match(/[a-z]+|./gi) || [];
const words = mergeWords(tokens).map(w => w.toLowerCase());
const getColor = (t) => {
  if (/^[a-z]+$/i.test(t)) {
    return allowedWords.has(t.toLowerCase()) ? "#15803d" : "#e11d48";
  }
  if ([".", ",", "?"].includes(t)) return "#0e9aa7";
  return "#e11d48";
};
const containerStyle = {
  width: "100%",
  maxWidth: 500,
  margin: "0 auto",
  padding: "0 20px",
  minHeight: 500,
  position: "relative"
};
const boxStyle = {
  width: "100%",
  minHeight: 60,
  padding: 10,
  boxSizing: "border-box",
  textAlign: "center"
};
const buttonRowStyle = {
  display: "flex",
  justifyContent: "center",
  gap: 15,
  marginTop: 30
};
const buttonStyle = {
  padding: "10px 20px",
  fontSize: 16,
  cursor: "pointer",
  minWidth: 120
};
const menuItemStyle = {
  padding: "8px 14px",
  cursor: "pointer",
  fontSize: 16
};

//MENU (spec Phase 3) — top-right ☰ on every page.
// stopPropagation so menu clicks don't advance intro/game reveals.
const renderMenu = () => (
  <div
    ref={menuRef}
    onClick={(e) => e.stopPropagation()}
    style={{
      position: "absolute",
      top: 10,
      right: 10,
      textAlign: "right",
      zIndex: 10
    }}
  >
    <button
      aria-label="Menu"
      onClick={() => {
        setMenuOpen((o) => !o);
        setMenuNote("");
      }}
      style={{
        fontSize: 22,
        background: "none",
        border: "none",
        cursor: "pointer"
      }}
    >
      ☰
    </button>
    {menuOpen && (
      <div
        className="dc-menu-panel"
        style={{
          textAlign: "left",
          minWidth: 190
        }}
      >
        {user ? (
          <div style={{ ...menuItemStyle, cursor: "default", opacity: 0.7, fontSize: 14 }}>
            Signed in as <b>{user.displayName}</b>
          </div>
        ) : (
          <div
            className="dc-menu-item" style={menuItemStyle}
            onClick={() => {
              setMenuOpen(false);
              setAuthStep("email");
              setAuthError("");
              setAuthCode("");
              setPage("account");
            }}
          >
            Sign in
          </div>
        )}
        <div
          className="dc-menu-item" style={menuItemStyle}
          onClick={() => {
            setMenuOpen(false);
            setNameDraft(user ? user.displayName : "");
            setSettingsNote("");
            setPage("settings");
          }}
        >
          Settings
        </div>
        <div
          className="dc-menu-item" style={menuItemStyle}
          onClick={() => {
            setMenuOpen(false);
            setPage("about");
          }}
        >
          About DotComma
        </div>
        <div
          className="dc-menu-item" style={menuItemStyle}
          onClick={() => setMenuNote("My answers is coming soon.")}
        >
          My answers
        </div>
        <div
          className="dc-menu-item" style={menuItemStyle}
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
          <div className="dc-menu-item" style={menuItemStyle} onClick={signOut}>
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

const debounceRef = useRef(null);
//DEBOUNCE
useEffect(() => {
  clearTimeout(debounceRef.current);
  debounceRef.current = setTimeout(() => {
    socket.emit("validate_text", text);
  }, 100);
}, [text]);

//??
useEffect(() => {  
  socket.on("validation_result", (data) => {
    setValidated(data);
  });
  return () => socket.off("validation_result");
}, []);

//RESET
useEffect(() => {
  if (page === "game") {
    setRevealIndex(0);
    setIsTyping(false); // stale isTyping blocked click-to-reveal
  }
}, [page, promptIndex]);

//RESTORE SESSION ON LOAD
useEffect(() => {
  const token = localStorage.getItem("dotcomma_token");
  if (!token) return;
  fetch(`${API_URL}/api/me`, {
    headers: { Authorization: `Bearer ${token}` }
  })
    .then((res) => (res.ok ? res.json() : Promise.reject()))
    .then((data) => setUser(data.user))
    .catch(() => localStorage.removeItem("dotcomma_token"));
}, []);

//SIGN OUT
const signOut = () => {
  const token = localStorage.getItem("dotcomma_token");
  if (token) {
    fetch(`${API_URL}/api/auth/signout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` }
    }).catch(() => {});
  }
  localStorage.removeItem("dotcomma_token");
  setUser(null);
  setMenuOpen(false);
};

//CLOSE MENU ON CLICK AWAY
// Capture-phase listener: a click outside the open menu closes it and is
// swallowed before page handlers run, so it doesn't advance the game.
// Clicks inside the menu (menuRef) pass through to the menu items.
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

//TOP ANSWERS
useEffect(() => {
  if (page !== "results") return;
  // Abort any in-flight fetch when this re-runs (e.g. when the just-
  // submitted answer finishes saving), so a stale response can't
  // overwrite the fresh list.
  const controller = new AbortController();
  const token = localStorage.getItem("dotcomma_token");
  fetch(
    `${API_URL}/api/prompts/${promptKeys[promptIndex]}/top-answers?sort=${sortBy}`,
    {
      signal: controller.signal,
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    }
  )
    .then((res) => res.json())
    .then((data) => setTopAnswers(data.answers || []))
    .catch((err) => {
      if (err.name !== "AbortError") setTopAnswers([]);
    });
  return () => controller.abort();
}, [page, promptIndex, answersVersion, sortBy]);

//SORT CHOICE + LIKES
const changeSort = (s) => {
  setSortBy(s);
  localStorage.setItem("dotcomma_sort", s);
};

const likeAnswer = (answerId) => {
  const token = localStorage.getItem("dotcomma_token");
  if (!token) {
    setLikeNote("Sign in to like answers.");
    return;
  }
  setLikeNote("");
  fetch(`${API_URL}/api/answers/${answerId}/like`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` }
  })
    .then((res) => (res.ok ? res.json() : Promise.reject()))
    .then((data) =>
      setTopAnswers((prev) =>
        prev.map((a) =>
          a.id === answerId
            ? { ...a, likes: data.likes, likedByMe: data.liked ? 1 : 0 }
            : a
        )
      )
    )
    .catch(() => {});
};

//SUBMIT ANSWER
const submitAnswer = () => {
  if (!text.trim()) return;

  setResults((prev) => {
    const copy = [...prev];
    copy[promptIndex] = text;
    return copy;
  });

  // Local validation keeps the results page instant; the backend
  // recomputes authoritatively for what gets saved.
  const wordList = words.filter((w) => /^[a-z]+$/i.test(w));
  const allGood =
    wordList.length > 0 &&
    wordList.every((w) => allowedWords.has(w.toLowerCase()));

  setResultMessage(allGood ? "Good work!" : "Better luck next time :(");

  // Persist in the background; the game stays playable if this fails.
  // Sends the session token when signed in so the answer links to the user.
  const token = localStorage.getItem("dotcomma_token");
  fetch(`${API_URL}/api/answers`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify({
      promptKey: promptKeys[promptIndex],
      answerText: text,
      visibility: "public"
    })
  })
    .then(() => setAnswersVersion((v) => v + 1)) // refresh top answers
    .catch((err) => console.error("Could not save answer:", err));

  setText("");
  setPage("results");
};

//ENTER AND BACKSPACE INPUT
useEffect(() => {
  const handleKey = (e) => {
    if (e.key === "Enter" && page === "game") {
      e.preventDefault();
      submitAnswer();
    }

    if (e.key === "Backspace" && page === "results") {
      setPage("game");
    }
  };
  window.addEventListener("keydown", handleKey);
  return () => window.removeEventListener("keydown", handleKey);
}, [text, page]);

//SETTINGS PAGE
if (page === "settings") {
  return (
    <div style={{ textAlign: "center", marginTop: 100, fontSize: 24 }}>
      <div className="dc-card-page" style={containerStyle}>
        {renderMenu()}
        <br /><br />
        <h2>Settings</h2>
        {user ? (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setSettingsNote("");
              try {
                const token = localStorage.getItem("dotcomma_token");
                const res = await fetch(`${API_URL}/api/me/display-name`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                  },
                  body: JSON.stringify({ displayName: nameDraft })
                });
                const data = await res.json();
                if (!res.ok) {
                  setSettingsNote(data.error || "Something went wrong.");
                  return;
                }
                setUser(data.user);
                setSettingsNote("Saved!");
              } catch {
                setSettingsNote("Could not reach the server.");
              }
            }}
          >
            <p style={{ fontSize: 16 }}>
              Display name — shown next to your public answers.
            </p>
            <input
              className="dc-input"
              value={nameDraft}
              maxLength={30}
              onChange={(e) => setNameDraft(e.target.value)}
              style={{
                fontSize: 18,
                padding: "8px 12px",
                textAlign: "center",
                width: 260,
                margin: "10px 0"
              }}
            />
            <br />
            <button type="submit" className="dc-button" style={buttonStyle}>
              Save
            </button>
          </form>
        ) : (
          <p style={{ fontSize: 16 }}>Sign in to change your display name.</p>
        )}
        {settingsNote && (
          <p style={{ fontSize: 14, opacity: 0.8 }}>{settingsNote}</p>
        )}
        <br />
        <button className="dc-button" style={buttonStyle} onClick={() => setPage("game")}>
          Back
        </button>
      </div>
    </div>
  );
}

//ACCOUNT / SIGN-IN PAGE
if (page === "account") {
  const inputStyle = {
    fontSize: 18,
    padding: "8px 12px",
    textAlign: "center",
    width: 260,
    margin: "10px 0"
  };
  return (
    <div style={{ textAlign: "center", marginTop: 100, fontSize: 24 }}>
      <div className="dc-card-page" style={containerStyle}>
        {renderMenu()}
        <br /><br />
        <h2>Sign in</h2>
        {authStep === "email" ? (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setAuthError("");
              try {
                const res = await fetch(`${API_URL}/api/auth/start`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ email: authEmail })
                });
                const data = await res.json();
                if (!res.ok) {
                  setAuthError(data.error || "Something went wrong.");
                  return;
                }
                setAuthStep("code");
              } catch {
                setAuthError("Could not reach the server.");
              }
            }}
          >
            <p style={{ fontSize: 16 }}>
              Enter your email and we will send you a sign-in code.
            </p>
            <input
              type="email"
              autoFocus
              className="dc-input"
              placeholder="you@example.com"
              value={authEmail}
              onChange={(e) => setAuthEmail(e.target.value)}
              style={inputStyle}
            />
            <br />
            <button type="submit" className="dc-button" style={buttonStyle}>Send code</button>
          </form>
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setAuthError("");
              try {
                const res = await fetch(`${API_URL}/api/auth/verify`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ email: authEmail, code: authCode })
                });
                const data = await res.json();
                if (!res.ok) {
                  setAuthError(data.error || "Something went wrong.");
                  return;
                }
                localStorage.setItem("dotcomma_token", data.token);
                setUser(data.user);
                setAuthCode("");
                setPage("game");
              } catch {
                setAuthError("Could not reach the server.");
              }
            }}
          >
            <p style={{ fontSize: 16 }}>
              We sent a 6-digit code to <b>{authEmail}</b>.
            </p>
            <input
              autoFocus
              className="dc-input"
              inputMode="numeric"
              placeholder="123456"
              maxLength={6}
              value={authCode}
              onChange={(e) => setAuthCode(e.target.value)}
              style={inputStyle}
            />
            <br />
            <button type="submit" className="dc-button" style={buttonStyle}>Sign in</button>
          </form>
        )}
        {authError && (
          <p style={{ color: "red", fontSize: 14 }}>{authError}</p>
        )}
        <br />
        <button className="dc-button" style={buttonStyle} onClick={() => setPage("game")}>
          Back
        </button>
      </div>
    </div>
  );
}

//ABOUT PAGE
if (page === "about") {
  // \n in the source marks paragraph breaks; HTML collapses raw newlines,
  // so split into real <p> elements here.
  const aboutParagraphs = aboutDotComma
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  return (
    <div className="dc-card-page" style={containerStyle}>{renderMenu()}<br/><br/>
      <h2>About DotComma</h2><br/>
      <div style={{ textAlign: "left" }}>
        {aboutParagraphs.map((p, i) => (
          <p key={i} style={{ marginBottom: 16 }}>{p}</p>
        ))}
      </div>
      <br/>
      <button className="dc-button" style = {buttonStyle}
        onClick={() => setPage("intro")}>Back</button>
      <br/><br/>
    </div>
  )}

//INTRO PAGE
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
      style={{
        textAlign: "center",
        marginTop: 100,
        fontSize: 24,
        cursor: "pointer"
      }}
    >
      <div className="dc-card-page" style={containerStyle}>
        {renderMenu()}
        <h2 style={{ fontSize: 32 }}>
          <br/><span className="dc-title">Welcome to DotComma</span>
        </h2>
        <br />
        {introIndex === 0 ? (
          <><span className="dc-hint" style = {{fontSize: 14}}> CLICK ANYWHERE TO CONTINUE</span> <br /><br /></>
        ) : (
          introPages.slice(0, introIndex).map((line, i) => (
            <div key={i} style={{ marginTop: 10 }}>
              {line}
            </div>
          ))
        )}
        <div
          style={{
            position: "absolute",
            bottom: 20,
            left: 0,
            width: "100%",
            fontSize: 14,
            textAlign: "center"
          }}
        >
          For more information, see{" "}
          <span
            className="no-advance"
            style={{
              color: "blue",
              cursor: "pointer",
              textDecoration: "underline",
              fontSize: 18
            }}
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

//RESULTS PAGE
if (page === "results") {
  const resultText = results[promptIndex] || "";
  const resultTokens = resultText.match(/[a-z]+|./gi) || [];
  const resultWords = mergeWords(resultTokens);
return (
<div style={{ textAlign: "center", marginTop: 100, fontSize: 24,}}>
  <div className="dc-card-page" style = {containerStyle}>
    {renderMenu()}
    <h2 style={{ fontSize: 24, minHeight: 200 }}>
      <br/><br/>{resultMessage}
    </h2>
    <div className="dc-typebox" style={{
      ...boxStyle,
      margin: "30px 0",
    }}>
      {resultWords.map((t, i) => (
        <span key={i} style={{ color: getColor(t), marginRight: 4 }}>
          {t}
        </span>
      ))}
    </div>
    <button
      className="dc-button" style={buttonStyle}
      onClick={() => {
        if (promptIndex >= prompts.length - 1) {
          setPage("intro");
        } else {
          setPromptIndex(i => i + 1);
          setRevealIndex(0);
          setText("");
          setPage("game");
        }
      }}
    >
      Continue
    </button>
    <button
      className="dc-button" style={buttonStyle}
      onClick={() => setPage("game")}
    >
      Try Again
    </button>
    {topAnswers.length > 0 && (
      <div style={{ textAlign: "left", fontSize: 16, margin: "30px 0" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 10
          }}
        >
          <p style={{ opacity: 0.7 }}>Other players wrote:</p>
          <span>
            <button
              className={`dc-chip${sortBy === "points" ? " dc-chip-active" : ""}`}
              onClick={() => changeSort("points")}
            >
              Points
            </button>
            {" "}
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
          <div
            key={a.id}
            className="dc-answer-card"
            style={{
              padding: "10px 14px",
              marginBottom: 10
            }}
          >
            <div>“{a.answer_text}”</div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: 4
              }}
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
                onClick={() => likeAnswer(a.id)}
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


//GAME PAGE
const stages = [
  ...gamePages[promptIndex].intro,
  gamePages[promptIndex].prompt
];
const fullDone = revealIndex >= stages.length;
return (
<div
  onClick={() => {
    if (!fullDone && !isTyping) {
      setRevealIndex(i => i + 1);
    }
  }}
  style={{
    textAlign: "center",
    marginTop: 100,
    fontSize: 24
  }}
>
  <div className="dc-card-page" style = {containerStyle}>
    {renderMenu()}
    <h2
      style={{
        minHeight: 200
      }}
    ><br/><br/>
      {headings[promptIndex]}
      {revealIndex === 0 && (
        <p className="dc-hint" style={{ fontSize: 14 }}>
          CLICK ANYWHERE TO CONTINUE
        </p>
      )}
    {stages.slice(0, revealIndex).map((line, i) => (
      <div
        key={i}
        style={{
          color: i === stages.length - 1 ? "var(--accent)" : "inherit",
          marginBottom: 18
        }}
      >
        {renderFormatted(line)}
      </div>
    ))}
    </h2>
    {fullDone && ( <> {/*wraps remainder of output HINT */}
    <h2>
      {clue[promptIndex] && clue[promptIndex] !== "NA" &&
        clue[promptIndex].split(" ").map((word, i) => (
          <span key={i} style={{ marginRight: 10, letterSpacing: 2 }}>
            {word}
          </span>
        ))
      }
    </h2>
    <div
      onClick={() => {
        inputRef.current?.focus();
        setIsTyping(true);
      }}        
      className="dc-typebox"
      style={{
        ...boxStyle,
        margin: "30px 0",
        cursor: "text",
      }}>
      {!isTyping && !text && (
        <span style={{ color: "#888" }}>Type here...</span>
      )}
      {words.map((t, i) => (
        <span
          key={i}
          style={{
            color: getColor(t),
            marginRight: 4
          }}
        >
          {t}
        </span>
      ))}
      {!text && isTyping && <span>|</span>}
    </div>
    <textarea //invisible box
      ref={inputRef}
      value={text}
      onChange={(e) => setText(e.target.value)}
      autoFocus
      style={{
        position: "absolute",
        opacity: 0,
        pointerEvents: "none"
      }}
    />
  <div style={buttonRowStyle}>
    <button
      className="dc-button" style={buttonStyle}
      onClick={submitAnswer}>
      Enter
    </button>
    {promptIndex > 0 && (
    <button
      className="dc-button" style={buttonStyle}
      onClick={() => {
        setPromptIndex((i) => i - 1);
        setPage("results");
      }}
    >
      Go Back
    </button>
    )}
  </div>

  <p style={{ fontSize: 13, opacity: 0.6 }}>
    Answers are shared with other players.
  </p>

  {hints[promptIndex] !== "NA" && (
    <p>{hints[promptIndex]}</p>
  )}

  {submitted.map((s, i) => (
    <p key={i}>{s}</p>
  ))}
  </>)}

  </div>
</div>

);
}

export default App;  // s1