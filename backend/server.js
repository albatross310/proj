const Fastify = require("fastify");  // s1
const { Server } = require("socket.io");  // s1

const app = Fastify();  // s1

app.register(require("@fastify/cors"), {  // s1
    origin: "*"
});

const server = app.server;  // s1
const io = new Server(server, {  // s1
    cors: { origin: "*" }
});

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
const merges = [
  ["be", "ing", "being"],
  ["see", "ing", "seeing"],
];
const allowedWords = new Set([
  ...baseWords,
  ...merges.map(([, , combined]) => combined)
])

io.on("connection", (socket) => {  // s1
  console.log("client connected");

  socket.on("validate_text", (text) => {
    const words = text.toLowerCase().match(/[a-z]+/g) || [];

    socket.emit(
      "validation_result",
      words.map((word) => ({
        word,
        valid: allowedWords.has(word),
      }))
    );
  });
});
app.get("/", async () => ({ ok: true}));  // s1

app.listen({port: 3000, host: "0.0.0.0" }, () => {  // s1
    console.log("http://localhost:3000");
});
