// The exact prompt the AI judge receives for an answer, rebuilt on the client
// so the results screen's ⓘ panel can show it (even while the verdict is still
// pending). This MIRRORS backend/ai-judge.js (SYSTEM_PROMPT + buildUserPrompt) —
// keep the two in sync if either changes.
import { gamePages, correctAnswers, answers } from "./prompts.jsx";

export const JUDGE_SYSTEM = [
  "You are the judge for DotComma, a word game.",
  "The player is shown one line written in wordy, old, or convoluted language,",
  "and must REWRITE it in short, plain words while keeping the same meaning.",
  "",
  "Decide whether the player's answer is a correct plain-words rewrite that",
  "preserves the meaning of the original line. The list of accepted answers you",
  "are given are EXAMPLES, not an exhaustive list — accept any wording that",
  "faithfully captures the meaning in simple words, even if phrased differently.",
  "Reject answers that change the meaning, miss the point, or are off-topic or",
  "nonsense.",
  "",
  "Return one of: 'accept', 'reject', or 'unsure'.",
  "Only return 'accept' or 'reject' when you are at least 98% confident either",
  "way. If there is any real doubt, return 'unsure'. Always report your honest",
  "confidence (0-100) and a one-line reason."
].join("\n");

export function buildJudgePrompt(promptIndex, answerText) {
  if (promptIndex == null || !gamePages[promptIndex]) return null;
  const accepted = [correctAnswers[promptIndex], ...(answers[promptIndex] || [])]
    .filter(Boolean)
    .map((a) => `  - ${a}`)
    .join("\n");
  const user = [
    `Original line to rewrite: ${gamePages[promptIndex].prompt}`,
    "",
    "Example accepted rewrites (not exhaustive):",
    accepted,
    "",
    `Player's answer: "${answerText}"`,
    "",
    "Does the player's answer correctly rewrite the original line in plain words"
  ].join("\n");
  return { system: JUDGE_SYSTEM, user };
}
