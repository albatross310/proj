import { useEffect, useState } from "react";  
import { io } from "socket.io-client"; 
import { useRef } from "react";

const socket = io(
  import.meta.env.DEV
    ? "http://localhost:3000"
    : "https://proj-1o7w.onrender.com"
);const merges = [
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
    <span style = {{fontSize: 16}}>
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
const [isTyping, setIsTyping] = useState(false);
const [results, setResults] = useState([]);
const [promptIndex, setPromptIndex] = useState(0);
const [introIndex, setIntroIndex] = useState(0);
const [revealIndex, setRevealIndex] = useState(0);
const resultText = results[promptIndex] || "";
const tokens = text.match(/[a-z]+|./gi) || [];
const words = mergeWords(tokens).map(w => w.toLowerCase());
const getColor = (t) => {
  if (/^[a-z]+$/i.test(t)) {
    return allowedWords.has(t.toLowerCase()) ? "green" : "red";
  }
  if ([".", ",", "?"].includes(t)) return "blue";
  return "red";
};
const containerStyle = {
  width: "100%",
  maxWidth: 500,
  margin: "0 auto",
  padding: "0 20px",
  border: "1px solid #ccc",
  minHeight: 500,
  position: "relative"   // ← add this
};
const boxStyle = {
  width: "100%",
  minHeight: 60,
  padding: 10,
  border: "1px solid #ccc",
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

let timeout;
//DEBOUNCE
useEffect(() => { 
  clearTimeout(timeout);
  timeout = setTimeout(() => {
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
  if (page === "game") setRevealIndex(0);
}, [page, promptIndex]);

//ENTER AND BACKSPACE INPUT
useEffect(() => { 
  const handleKey = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (!text.trim()) return;

      setResults((prev) => {
        const copy = [...prev];
        copy[promptIndex] = text;
        return copy;
      });

      const wordList = words.filter((w) => /^[a-z]+$/i.test(w));
      const allGood =
        wordList.length > 0 &&
        wordList.every((w) => allowedWords.has(w.toLowerCase()));

      setResultMessage(allGood ? "Good work!" : "Better luck next time :(");

      setText("");
      setPage("results");
    }

    if (e.key === "Backspace" && page === "results") {
      setPage("game");
    }
  };
  window.addEventListener("keydown", handleKey);
  return () => window.removeEventListener("keydown", handleKey);
}, [text, page]);

//ABOUT PAGE
if (page === "about") {
  return (
    <div style={containerStyle}><br/><br/>
      <h2>About DotComma</h2><br/>
      <p>{aboutDotComma}</p><br/><br/>
      <button style = {buttonStyle} 
        onClick={() => setPage("intro")}>Back</button>
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
      <div style={containerStyle}>
        <h2 style={{ fontSize: 32, color: "purple" }}>
          <br/>Welcome to DotComma
        </h2>
        <br />
        {introIndex === 0 ? (
          <><span style = {{fontSize: 14}}> CLICK ANYWHERE TO CONTINUE</span> <br /><br /></>
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
  <div style = {containerStyle}>
    <h2 style={{ fontSize: 24, minHeight: 200 }}>
      <br/><br/>{resultMessage}
    </h2>
    <div style={{
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
      style={buttonStyle}
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
      style={buttonStyle}
      onClick={() => setPage("game")}
    >
      Try Again
    </button>
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
  <div style = {containerStyle}>
    <h2
      style={{
        minHeight: 200
      }}
    ><br/><br/>
      {headings[promptIndex]}
      {!fullDone && (
        <p style={{ fontSize: 14, opacity: 0.6 }}>
          CLICK ANYWHERE TO CONTINUE
        </p>
      )}
    {stages.slice(0, revealIndex).map((line, i) => (
      <div
        key={i}
        style={{
          color: i === stages.length - 1 ? "purple" : "inherit"
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
      style={buttonStyle}
      onClick={() => {
      if (!text.trim()) return;
      setResults((prev) => {
        const copy = [...prev];
        copy[promptIndex] = text;
        return copy;
      });
      const wordList = words.filter((w) => /^[a-z]+$/i.test(w));
      const allGood =
        wordList.length > 0 &&
        wordList.every((w) => allowedWords.has(w.toLowerCase()));
      setResultMessage(allGood ? "Good work!" : "Better luck next time :(");
      setText("");
      setPage("results");
    }}>
      Enter
    </button>
    {promptIndex > 0 && (
    <button
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