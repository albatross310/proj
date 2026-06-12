// Word data + validation for DotComma. The data lives in content/words.txt;
// edit that file and run `node scripts/build-content.mjs` to regenerate
// shared/words.json. Never edit the JSON by hand.
const wordData = require("./shared/words.json");

const baseWords = new Set(wordData.baseWords);
const merges = wordData.merges;

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
