// DotComma vocabulary + merge rules. The data lives in content/words.txt
// (shared with the backend) — edit that file and run
// `node scripts/build-content.mjs`; never edit the generated JSON.
// The backend copy of the same data stays authoritative for scoring.
import wordData from "./shared/words.json";

export const baseWords = new Set(wordData.baseWords);

export const merges = wordData.merges;

export const allowedWords = new Set([
  ...baseWords,
  ...merges.map(([, , combined]) => combined)
]);

export function mergeWords(tokens) {
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
