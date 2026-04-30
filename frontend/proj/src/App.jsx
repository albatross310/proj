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
  // language-related nouns
  "word","text","line","name","term","sign","sound","tone","mark","form",
  "type","code","rule","set","list","note","voice","speech","talk","chat",
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

const prompt = `Break the rules of grammar and think smart:\n 
                Write this sentence using only the 200 most 
                common english monosyllables:`;
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
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 40 }}>
    <h2 style={{whiteSpace: "pre-line", 
      width: "66%", marginTop: 200,  
      marginBottom: 50 }}>{prompt}
    </h2>
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