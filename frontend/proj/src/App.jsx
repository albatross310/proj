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
  "i","you","we","they","he","she","it","me","him","her","us","them",
  // core verbs (monosyllable)
  "be","am","is","are","do","did","has","have","go","goes","see","sees","say","says",
  "make","makes","take","takes","get","gets","give","gives","find","finds","think",
  "thinks","know","knows","want","wants","try","tries","use","uses","work","works",
  "call","calls","ask","asks","need","needs","feel","feels","leave","leaves","put",
  "puts","keep","keeps","let","lets","help","helps","talk","talks","turn","turns",
  "start","starts","show","shows","hear","hears","play","plays","run","runs","move",
  "moves","live","lives","hold","holds","bring","brings","write","writes","read",
  "reads","sit","sits","stand","stands","lose","loses","pay","pays","meet","meets",
  "set","sets","learn","learns","change","changes","lead","leads","watch","watches",
  "stop","stops","add","adds","spend","spends","grow","grows","open","opens","walk",
  "walks","win","wins","wait","waits","serve","serves","die","dies","send","sends",
  "build","builds","stay","stays","fall","falls","cut","cuts","reach","reaches",
  // language-related nouns
  "word","text","line","name","term","sign","sound","tone","mark","form","type",
  "code","script","rule","set","list","note","voice","speech","talk","chat",
  // general nouns
  "time","day","year","way","man","world","life","hand","part","child","eye","place",
  "work","week","case","point","group","fact","home","room","side","kind","head",
  "house","friend","power","hour","game","end","law","car","city","team","name",
  // number words (monosyllable only)
  "one","two","three","four","five","six","seven","eight","nine","ten",
  "plus", "times")
  // modifiers
  "good","bad","big","small","long","short","high","low","fast","slow","new","old"
]);
marginTop: 40, ]);
const allowedWords = new Set([
  ...baseWords,
  ...merges.map(([, , combined]) => combined)
])

const prompt = "Break the rules of grammar and think smart: Write this sentence using only the 200 most common english monosyllables:";

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