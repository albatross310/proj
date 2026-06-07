// Shared word data + validation for DotComma.
// TODO (spec Phase 7): frontend duplicates this list; backend is authoritative.
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
]);

// Same merge pass the frontend runs: "be ing" -> "being".
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

// Authoritative validation: tokenise like the frontend (words + punctuation),
// apply merges, then check each word against allowedWords.
function validateText(text) {
  const tokens = String(text).match(/[a-z]+|./gi) || [];
  const words = mergeWords(tokens)
    .map((t) => t.toLowerCase())
    .filter((t) => /^[a-z]+$/.test(t));

  const perWord = words.map((word) => ({
    word,
    valid: allowedWords.has(word),
  }));

  const validCount = perWord.filter((w) => w.valid).length;
  const invalidCount = perWord.length - validCount;

  return {
    words: perWord,
    validCount,
    invalidCount,
    allValid: perWord.length > 0 && invalidCount === 0,
  };
}

module.exports = { baseWords, merges, allowedWords, mergeWords, validateText };
