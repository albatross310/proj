import { useEffect, useState } from "react";  // s1
import { io } from "socket.io-client";  // s1

const socket = io(
  import.meta.env.DEV
    ? "http://localhost:3000"
    : "https://proj-1o7w.onrender.com"
);const merges = [
  ["be", "ing", "being"],
  ["see", "ing", "seeing"]
];
const baseWords = new Set([
  "i","you","we","they",
  // verbs (present tense)
  "be","am","is","are","do","does","have","has","go","goes","see","sees","say","says",
  "make","makes","take","takes","get","gets","give","gives","find","finds","think","thinks",
  "know","knows","want","wants","try","tries","use","uses","work","works","call","calls",
  "ask","asks","need","needs","feel","feels","leave","leaves","put","puts","keep","keeps",
  "let","lets","begin","begins","seem","seems","help","helps","talk","talks","turn","turns",
  "start","starts","show","shows","hear","hears","play","plays","run","runs","move","moves",
  "live","lives","hold","holds","bring","brings","write","writes","sit","sits","stand","stands",
  "lose","loses","pay","pays","meet","meets","set","sets","learn","learns","change","changes",
  "lead","leads","watch","watches","follow","follows","stop","stops","create","creates",
  "speak","speaks","read","reads","allow","allows","add","adds","spend","spends","grow","grows",
  "open","opens","walk","walks","win","wins","offer","offers","remember","remembers",
  "love","loves","consider","considers","appear","appears","buy","buys","wait","waits",
  "serve","serves","die","dies","send","sends","expect","expects","build","builds","stay","stays",
  "fall","falls","cut","cuts","reach","reaches","remain","remains",
  // nouns
  "time","person","year","way","day","thing","man","world","life","hand","part","child",
  "eye","woman","place","work","week","case","point","government","company","number",
  "group","problem","fact","home","water","room","mother","area","money","story","issue",
  "side","kind","head","house","service","friend","father","power","hour","game","line",
  "end","member","law","car","city","community","name","president","team","minute",
  "idea","kid","body","information","back","parent","face","others","level","office",
  "door","health","person","art","war","history","party","result","change","morning",
  "reason","research","girl","guy","moment","air","teacher","force","education"
]);
const allowedWords = new Set([
  ...baseWords,
  ...merges.map(([, , combined]) => combined)
])

const prompt = "Write this sentence using only the 200 most common english words:";

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

function App() {
  const [text, setText] = useState(""); //s1
  const [validated, setValidated] = useState([]); // s2
  const tokens = text.match(/[a-z]+|./gi) || [];
  const words = mergeWords(tokens);

  let timeout;
  useEffect(() => {  // s1
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      socket.emit("validate_text", text);
    }, 100);  
  }, [text]); 

  useEffect(() => {  // s2
    socket.on("validation_result", (data) => {
      setValidated(data);
    });
    return () => socket.off("validation_result");
  }, []);

return (
  <div>
    <h2 style={{marginTop: 60,  marginBottom: 16 }}>{prompt}</h2>
    <textarea
      style={{ width: "66%", height: 80 }}
      value={text}
      onChange={(e) => setText(e.target.value)}
    />

    <div>
      {words.map((t, i) => (
        <span
          key={i}
          style={{
            color: /^[a-z]+$/.test(t)
              ? (allowedWords.has(t) ? "green" : "red")
              : ([".", ",", "?"].includes(t) ? "blue" : "red"),
            marginRight: 6
          }}
        >
          {t}
        </span>
      ))}
    </div>
  </div>
);
}

export default App;  // s1