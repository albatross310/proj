import { useEffect, useState } from "react";  // s1
import { io } from "socket.io-client";  // s1

const socket = io("http://localhost:3000");
const merges = [
  ["be", "ing", "being"],
  ["see", "ing", "seeing"]
];
const baseWords = new Set(["i","you","we","they",  // s1
  "be","am","is","are","was",
  "do","did","not","no","can",
  "will","go","see","say","good",
  "bad","big","small", 
]);
const allowedWords = new Set([
  ...baseWords,
  ...merges.map(([, , combined]) => combined)
])

const prompt = "Say why we fear new things";

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
    <h2 style={{ marginBottom: 16 }}>{prompt}</h2>
    <textarea
      style={{ width: "75%", height: 80 }}
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