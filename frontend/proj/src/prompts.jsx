// DotComma prompts. Add new prompts by appending blocks to the script
// below — columns are | separated, blocks are --- separated:
//
//   HEADING | INTRO | PROMPT | CLUE | CORRECT | ANSWERS | HINT
//
// - INTRO can hold several lines (each revealed by a click)
// - ANSWERS can hold several accepted answers separated by ;
// - Use NA for CLUE/HINT when a prompt doesn't have one
// - **bold** works inside INTRO/PROMPT text
const script = `
HEADING | INTRO | PROMPT | CLUE | CORRECT | ANSWERS | HINT
---
Rule 1: Be simple! |
Rewrite the following line in **short**, plain words.|
"I try write this line with not-long words." |
Clue:  I t__ __ ___t_ ___ l___ _n ___r_ ___d_. |
I try write to write the line in short words |
I try write to write the line in short words |
NA
---
`;

export function parseScript(script) {
  return script
    .split("---")
    .map(row => row.trim())
    .filter(row => row && !row.startsWith("HEADING"))
    .map(row => {
    const [heading, intro, prompt, clue, correct, answers, hint] = row
      .split("|")
      .map(cell => cell.trim());

    return {
      heading: heading + "\n",
      intro: intro
        .split("\n")
        .map(x => x.trim())
        .filter(Boolean),
      prompt: prompt + "\n",
      clue,
      correct,
      answers: answers ? answers.split(";").map(a =>
        a.trim()).filter(Boolean) : [],
      hint
    };
  });
}

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

export const gamePages = parseScript(script);

// Stable key per prompt, e.g. "Rule 1: Be simple!" -> "rule-1-be-simple".
// NOTE: keys derive from headings — rewording a heading orphans that
// prompt's saved answers.
export const promptKeys = gamePages.map(p =>
  p.heading
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
);

export const headings = gamePages.map(p => renderFormatted(p.heading));
export const prompts = gamePages.map(p => renderFormatted(p.prompt));
export const clue = gamePages.map(p => p.clue);
export const correctAnswers = gamePages.map(p => p.correct);
export const hints = gamePages.map(p => p.hint);
export const answers = gamePages.map(p => p.answers);
