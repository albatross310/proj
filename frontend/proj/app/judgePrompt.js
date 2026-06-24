// The exact prompt the AI judge receives for an answer, rebuilt on the client
// so the results screen's ⓘ panel can show it (even while the verdict is still
// pending). This MIRRORS backend/ai-judge.js (SYSTEM_PROMPT + buildUserPrompt) —
// keep the two in sync if either changes.
import { gamePages } from "./prompts.jsx";

export const JUDGE_SYSTEM = [
  "You are the judge for DotComma, a word game.",
  "The player is shown one line written in wordy, old, or convoluted language,",
  "and must REWRITE it in short, plain words while keeping the same meaning.",
  "",
  "Judge ONLY by meaning: does the player's answer convey the meaning of the",
  "ORIGINAL line? There is no single correct wording — accept any answer,",
  "however phrased, that captures the gist of the original in plainer words.",
  "",
  "Be PERMISSIVE. Your only job is to filter out answers that are OBVIOUSLY",
  "wrong — off-topic, nonsense or gibberish, blank, or that clearly contradict",
  "or completely miss the meaning. Accept anything that plausibly captures the",
  "gist in plainer words, even if it is loose, partial, clumsy, or not how you",
  "would phrase it. A wrongly REJECTED good answer is far worse than letting a",
  "so-so answer through, so when in any doubt, ACCEPT.",
  "",
  "Return one of: 'accept', 'reject', or 'unsure'. Only 'reject' when you are",
  "essentially certain (>=98%) the answer is wrong. Use 'unsure' only for a",
  "genuine coin-flip you cannot resolve. Report your confidence (0-100) in the",
  "verdict and a one-line reason."
].join("\n");

export function buildJudgePrompt(promptIndex, answerText) {
  if (promptIndex == null || !gamePages[promptIndex]) return null;
  const user = [
    `Original line to rewrite: ${gamePages[promptIndex].prompt}`,
    "",
    `Player's answer: "${answerText}"`,
    "",
    "Does the player's answer correctly rewrite the original line in plain words"
  ].join("\n");
  return { system: JUDGE_SYSTEM, user };
}
