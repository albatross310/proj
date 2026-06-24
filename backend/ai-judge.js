// AI answer judge — decides whether a player's plain-words rewrite faithfully
// captures the meaning of the original prompt line.
//
// Cascade (cheap -> careful), so most answers settle on the cheapest model and
// only the genuinely ambiguous ones cost more:
//
//   1. Haiku   judges on submit (fire-and-forget; never blocks the player).
//   2. Sonnet  re-judges anything Haiku is "unsure" about.
//   3. Opus    batch-judges whatever is still "unsure", every 10 minutes.
//   4. E-mail  the stragglers Opus still can't call go to ALERT_EMAIL_TO.
//
// A model may only commit to accept/reject when it is >= 98% confident either
// way; below that the verdict is forced to "unsure" and escalates. Verdicts are
// written back onto the answers row (ai_verdict/ai_tier/ai_confidence/ai_reason).
require("./env.js");
const Anthropic = require("@anthropic-ai/sdk");
const nodemailer = require("nodemailer");
const db = require("./db.js");

const prompts = require("./shared/prompts.json");
const promptsByKey = new Map(prompts.map((p) => [p.key, p]));

// Confidence (0-100) a model must reach to commit to accept/reject. Anything
// less is treated as "unsure" and escalated to the next tier.
const CONFIDENCE_THRESHOLD = 98;

// How often the Opus drain runs over the accumulated "unsure" answers.
const OPUS_INTERVAL_MS = 10 * 60 * 1000;

const MODELS = {
  haiku: "claude-haiku-4-5",
  sonnet: "claude-sonnet-4-6",
  opus: "claude-opus-4-8"
};

const apiKey = process.env.ANTHROPIC_API_KEY;
const enabled = Boolean(apiKey);
const client = enabled ? new Anthropic({ apiKey }) : null;
if (!enabled) {
  console.warn(
    "[ai-judge] ANTHROPIC_API_KEY not set — answer judging is disabled."
  );
}

// --- E-mail transport for stragglers (optional; logs if not configured). ---
const ALERT_TO = process.env.ALERT_EMAIL_TO || "petergibson127@gmail.com";
const ALERT_FROM = process.env.ALERT_EMAIL_FROM || process.env.SMTP_USER;
let transporter = null;
if (process.env.SMTP_HOST) {
  const port = Number(process.env.SMTP_PORT) || 587;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined
  });
}

const VERDICT_SCHEMA = {
  type: "object",
  properties: {
    verdict: { type: "string", enum: ["accept", "reject", "unsure"] },
    confidence: { type: "integer", minimum: 0, maximum: 100 },
    reason: { type: "string" }
  },
  required: ["verdict", "confidence", "reason"],
  additionalProperties: false
};

const SYSTEM_PROMPT = [
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

function buildUserPrompt(prompt, answerText) {
  const accepted = [prompt.correct, ...(prompt.answers || [])]
    .filter(Boolean)
    .map((a) => `  - ${a}`)
    .join("\n");
  return [
    `Original line to rewrite: ${prompt.prompt}`,
    "",
    "Example accepted rewrites (not exhaustive):",
    accepted,
    "",
    `Player's answer: "${answerText}"`,
    "",
    "Does the player's answer correctly rewrite the original line in plain words"
  ].join("\n");
}

// Run one model over one answer. Returns { verdict, confidence, reason } with
// the 98% rule already applied (accept/reject below threshold -> unsure).
async function classify(modelKey, prompt, answerText) {
  // Adaptive thinking is only on 4.6+ models; Haiku 4.5 runs without it (and
  // it keeps the cheap first-pass fast).
  const useThinking = modelKey !== "haiku";

  const req = {
    model: MODELS[modelKey],
    max_tokens: useThinking ? 6000 : 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserPrompt(prompt, answerText) }],
    output_config: { format: { type: "json_schema", schema: VERDICT_SCHEMA } }
  };
  if (useThinking) req.thinking = { type: "adaptive" };

  const response = await client.messages.create(req);

  // output_config.format guarantees the text block is valid JSON for the schema.
  const block = response.content.find((b) => b.type === "text");
  const data = JSON.parse(block.text);

  let verdict = data.verdict;
  const confidence = Math.max(0, Math.min(100, Math.round(Number(data.confidence))));
  if (
    (verdict === "accept" || verdict === "reject") &&
    confidence < CONFIDENCE_THRESHOLD
  ) {
    verdict = "unsure";
  }
  return { verdict, confidence, reason: String(data.reason || "").slice(0, 500) };
}

async function persist(answerId, tier, result) {
  await db.query(
    `UPDATE answers
        SET ai_verdict = $1, ai_tier = $2, ai_confidence = $3,
            ai_reason = $4, ai_judged_at = now()
      WHERE id = $5`,
    [result.verdict, tier, result.confidence ?? null, result.reason ?? null, answerId]
  );
}

// In-memory queue of answers still "unsure" after Sonnet, drained by Opus.
// Single-instance deploy, so a plain array is enough (matches the rate limiter).
const opusQueue = [];

// Entry point: judge a freshly-stored answer. Fire-and-forget from the route.
// `answer` is the inserted row ({ id, prompt_key, answer_text, ... }).
async function judgeNewAnswer(answer) {
  if (!enabled || !answer) return;
  const prompt = promptsByKey.get(answer.prompt_key);
  if (!prompt) return;

  try {
    let tier = "haiku";
    let result = await classify("haiku", prompt, answer.answer_text);

    if (result.verdict === "unsure") {
      tier = "sonnet";
      result = await classify("sonnet", prompt, answer.answer_text);
    }

    await persist(answer.id, tier, result);

    if (result.verdict === "unsure") {
      opusQueue.push({
        id: answer.id,
        prompt_key: answer.prompt_key,
        answer_text: answer.answer_text
      });
    }
  } catch (err) {
    console.error(`[ai-judge] failed to judge answer ${answer.id}:`, err.message);
    await persist(answer.id, "error", {
      verdict: "error",
      confidence: 0,
      reason: err.message
    }).catch(() => {});
  }
}

// Every 10 minutes, re-judge the accumulated "unsure" answers with Opus.
// Whatever Opus still can't call gets e-mailed for human review.
async function drainOpusQueue() {
  if (!enabled || opusQueue.length === 0) return;

  const batch = opusQueue.splice(0, opusQueue.length);
  const stragglers = [];

  for (const item of batch) {
    const prompt = promptsByKey.get(item.prompt_key);
    if (!prompt) continue;
    try {
      const result = await classify("opus", prompt, item.answer_text);
      await persist(item.id, "opus", result);
      if (result.verdict === "unsure") stragglers.push({ ...item, result });
    } catch (err) {
      console.error(`[ai-judge] Opus failed on answer ${item.id}:`, err.message);
      const result = { verdict: "error", confidence: 0, reason: err.message };
      await persist(item.id, "opus", result).catch(() => {});
      stragglers.push({ ...item, result });
    }
  }

  if (stragglers.length) await emailStragglers(stragglers);
}

async function emailStragglers(stragglers) {
  const body = stragglers
    .map(
      (s) =>
        `#${s.id}  [${s.prompt_key}]\n` +
        `  prompt: ${promptsByKey.get(s.prompt_key)?.prompt || "?"}\n` +
        `  answer: "${s.answer_text}"\n` +
        `  note:   ${s.result.reason}`
    )
    .join("\n\n");
  const text =
    `${stragglers.length} DotComma answer(s) couldn't be settled automatically ` +
    `(still unsure after Haiku, Sonnet and Opus):\n\n${body}\n`;

  if (!transporter) {
    console.warn(
      "[ai-judge] SMTP not configured — would have e-mailed these stragglers:\n" +
        text
    );
    return;
  }

  try {
    await transporter.sendMail({
      from: ALERT_FROM,
      to: ALERT_TO,
      subject: `DotComma: ${stragglers.length} answer(s) need review`,
      text
    });
  } catch (err) {
    console.error("[ai-judge] failed to send straggler e-mail:", err.message);
  }
}

if (enabled) {
  setInterval(drainOpusQueue, OPUS_INTERVAL_MS).unref();
}

module.exports = { judgeNewAnswer, drainOpusQueue };
