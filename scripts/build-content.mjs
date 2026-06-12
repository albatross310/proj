// DotComma content build.
//
//   node scripts/build-content.mjs            build shared/*.json from content/
//   node scripts/build-content.mjs --check    verify shared/*.json is up to date (no writes)
//   node scripts/build-content.mjs --strict   treat vocabulary warnings as errors
//
// Reads  content/words.txt, content/prompts.txt
// Writes words.json + prompts.json into each consumer (backend/shared/,
// frontend/proj/app/shared/) so neither deploy needs to reach outside its
// own root directory. The copies are committed; the .txt files are the
// only thing you edit.
//
// Errors (exit 1, nothing written): missing required prompt fields,
// duplicate keys, unknown field names, malformed merge lines.
// Warnings (exit 0 unless --strict): CORRECT/ANSWERS containing words
// that the game's validator would mark invalid.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const contentDir = join(root, "content");
const targetDirs = [
  join(root, "backend", "shared"),
  join(root, "frontend", "proj", "app", "shared"),
];

const CHECK = process.argv.includes("--check");
const STRICT = process.argv.includes("--strict");

const errors = [];
const warnings = [];

// ---------------------------------------------------------------- words.txt

function parseWords(text) {
  const words = new Set();
  const merges = [];
  let section = "words";

  text.split("\n").forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith("#")) return;

    if (line === "[merges]") {
      section = "merges";
      return;
    }

    if (section === "merges") {
      // be + ing = being
      const m = line.match(/^([a-z]+)\s*\+\s*([a-z]+)\s*=\s*([a-z]+)$/);
      if (!m) {
        errors.push(`words.txt:${i + 1}: malformed merge line "${line}" (expected: a + b = combined)`);
        return;
      }
      merges.push([m[1], m[2], m[3]]);
      return;
    }

    for (const w of line.split(/\s+/)) {
      if (!/^[a-z]+$/.test(w)) {
        errors.push(`words.txt:${i + 1}: "${w}" is not a plain lowercase word`);
        continue;
      }
      words.add(w);
    }
  });

  return { baseWords: [...words].sort(), merges };
}

// -------------------------------------------------------------- prompts.txt

const REQUIRED = ["KEY", "HEADING", "PROMPT", "CORRECT"];
const FIELDS = ["KEY", "HEADING", "INTRO", "PROMPT", "CLUE", "CORRECT", "ANSWERS", "HINT"];

function parsePrompts(text) {
  const prompts = [];
  const seenKeys = new Set();
  let block = null;
  let blockLine = 0;

  const flush = () => {
    if (!block) return;
    for (const f of REQUIRED) {
      if (!block[f]) errors.push(`prompts.txt:${blockLine}: prompt block is missing ${f}`);
    }
    if (block.KEY) {
      if (seenKeys.has(block.KEY)) errors.push(`prompts.txt:${blockLine}: duplicate KEY "${block.KEY}"`);
      seenKeys.add(block.KEY);
      if (!/^[a-z0-9-]+$/.test(block.KEY)) {
        errors.push(`prompts.txt:${blockLine}: KEY "${block.KEY}" must be lowercase letters, digits, and dashes`);
      }
    }
    prompts.push({
      key: block.KEY ?? null,
      heading: block.HEADING ?? "",
      intro: block.INTRO ?? [],
      prompt: block.PROMPT ?? "",
      clue: block.CLUE === "NA" ? null : block.CLUE ?? null,
      correct: block.CORRECT ?? "",
      answers: block.ANSWERS
        ? block.ANSWERS.split(" | ").map((a) => a.trim()).filter(Boolean)
        : [],
      hint: block.HINT === "NA" ? null : block.HINT ?? null,
    });
    block = null;
  };

  text.split("\n").forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith("#")) return;

    if (line === "---") {
      flush();
      return;
    }

    const m = raw.match(/^([A-Z]+):\s?(.*)$/);
    if (!m) {
      errors.push(`prompts.txt:${i + 1}: expected "FIELD: value" but got "${line}"`);
      return;
    }
    const [, field, value] = m;
    if (!FIELDS.includes(field)) {
      errors.push(`prompts.txt:${i + 1}: unknown field "${field}" (allowed: ${FIELDS.join(", ")})`);
      return;
    }

    if (!block) {
      block = {};
      blockLine = i + 1;
    }

    const v = value.trimEnd();
    if (field === "INTRO") {
      (block.INTRO ??= []).push(v);
    } else if (field in block) {
      errors.push(`prompts.txt:${i + 1}: repeated field "${field}" (only INTRO may repeat)`);
    } else {
      block[field] = v;
    }
  });
  flush();

  return prompts;
}

// ------------------------------------------------- vocabulary lint (game's
// validator, replicated from backend/words.js so authoring errors surface
// here instead of in front of players)

function makeValidator({ baseWords, merges }) {
  const allowed = new Set([...baseWords, ...merges.map(([, , c]) => c)]);

  const mergeTokens = (tokens) => {
    const out = [];
    for (let i = 0; i < tokens.length; i++) {
      let merged = false;
      for (const [a, b, combined] of merges) {
        if (tokens[i] === a && tokens[i + 1] === " " && tokens[i + 2] === b) {
          out.push(combined);
          i += 2;
          merged = true;
          break;
        }
      }
      if (!merged) out.push(tokens[i]);
    }
    return out;
  };

  return (text) => {
    const tokens = String(text).match(/[a-z]+|./gi) || [];
    const words = mergeTokens(tokens)
      .map((t) => t.toLowerCase())
      .filter((t) => /^[a-z]+$/.test(t));
    return words.filter((w) => !allowed.has(w));
  };
}

// --------------------------------------------------------------------- main

const wordData = parseWords(readFileSync(join(contentDir, "words.txt"), "utf8"));
const prompts = parsePrompts(readFileSync(join(contentDir, "prompts.txt"), "utf8"));

const invalidWordsIn = makeValidator(wordData);
for (const p of prompts) {
  for (const [label, text] of [["CORRECT", p.correct], ...p.answers.map((a) => ["ANSWERS", a])]) {
    if (!text) continue;
    const bad = invalidWordsIn(text);
    if (bad.length) {
      warnings.push(
        `prompt "${p.key}": ${label} "${text}" contains words the game will mark invalid: ${bad.join(", ")}`
      );
    }
  }
}

if (errors.length) {
  console.error("Content build FAILED:\n" + errors.map((e) => "  ✗ " + e).join("\n"));
  process.exit(1);
}

for (const w of warnings) console.warn("  ⚠ " + w);
if (STRICT && warnings.length) {
  console.error(`Content build FAILED (--strict): ${warnings.length} vocabulary warning(s) above.`);
  process.exit(1);
}

const out = {
  "words.json": JSON.stringify(wordData, null, 2) + "\n",
  "prompts.json": JSON.stringify(prompts, null, 2) + "\n",
};

if (CHECK) {
  const stale = [];
  for (const dir of targetDirs) {
    for (const f of Object.keys(out)) {
      const path = join(dir, f);
      if (!existsSync(path) || readFileSync(path, "utf8") !== out[f]) stale.push(path);
    }
  }
  if (stale.length) {
    console.error(
      `Content check FAILED, out of date:\n${stale.map((p) => "  " + p).join("\n")}\n` +
        "Run `node scripts/build-content.mjs` and commit."
    );
    process.exit(1);
  }
  console.log("Content check OK: generated JSON matches content/.");
} else {
  for (const dir of targetDirs) {
    mkdirSync(dir, { recursive: true });
    for (const [f, body] of Object.entries(out)) writeFileSync(join(dir, f), body);
  }
  console.log(
    `Built words.json (${wordData.baseWords.length} words, ${wordData.merges.length} merges) ` +
      `and prompts.json (${prompts.length} prompt${prompts.length === 1 ? "" : "s"}) ` +
      `into: ${targetDirs.map((d) => d.slice(root.length + 1)).join(", ")}`
  );
}
