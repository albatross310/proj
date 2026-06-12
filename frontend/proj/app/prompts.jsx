// DotComma prompts. The deck lives in content/prompts.txt — edit that file
// and run `node scripts/build-content.mjs`; never edit the generated JSON.
// Deck order = file order.
import promptData from "./shared/prompts.json";

export function renderFormatted(script) {
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

// Same shape the old script parser produced. clue/hint keep the "NA"
// sentinel (the JSON uses null) because the pages check for it; the
// trailing \n on heading renders as the <br> after the title.
export const gamePages = promptData.map((p) => ({
  heading: p.heading + "\n",
  intro: p.intro,
  prompt: p.prompt,
  clue: p.clue ?? "NA",
  correct: p.correct,
  answers: p.answers,
  hint: p.hint ?? "NA",
}));

// Stable keys come straight from the content file's KEY field, so rewording
// a heading no longer orphans that prompt's saved answers.
export const promptKeys = promptData.map((p) => p.key);

export const headings = gamePages.map(p => renderFormatted(p.heading));
export const prompts = gamePages.map(p => renderFormatted(p.prompt));
export const clue = gamePages.map(p => p.clue);
export const correctAnswers = gamePages.map(p => p.correct);
export const hints = gamePages.map(p => p.hint);
export const answers = gamePages.map(p => p.answers);
