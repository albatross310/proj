// Smoke test for the Anthropic API key + answer judge.
//   node scripts/check-ai.js
// Loads backend/.env (same as the server), then runs one real Haiku judgement
// against a known prompt/answer pair and prints the verdict. Exits non-zero on
// any failure, so it's safe to gate a deploy on.
require("../env.js");
const Anthropic = require("@anthropic-ai/sdk");

const key = process.env.ANTHROPIC_API_KEY;
if (!key) {
  console.error(
    "✗ ANTHROPIC_API_KEY is not set.\n" +
      "  Add it to backend/.env (ANTHROPIC_API_KEY=sk-ant-...) or your shell env."
  );
  process.exit(1);
}

const SCHEMA = {
  type: "object",
  properties: {
    verdict: { type: "string", enum: ["accept", "reject", "unsure"] },
    confidence: { type: "integer", description: "Confidence from 0 to 100" },
    reason: { type: "string" }
  },
  required: ["verdict", "confidence", "reason"],
  additionalProperties: false
};

async function main() {
  const client = new Anthropic({ apiKey: key });
  console.log("→ calling claude-haiku-4-5 …");
  const res = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 1024,
    system:
      "You judge whether a player's plain-words rewrite preserves the meaning " +
      "of an original line. Return accept/reject/unsure with confidence 0-100.",
    messages: [
      {
        role: "user",
        content:
          'Original: "I utilize sophisticated vocabulary to communicate my thinking."\n' +
          'Player\'s answer: "I use short words to talk"\n' +
          "Does it correctly rewrite the line in plain words?"
      }
    ],
    output_config: { format: { type: "json_schema", schema: SCHEMA } }
  });

  const text = res.content.find((b) => b.type === "text").text;
  const data = JSON.parse(text);
  console.log("✓ API key works. Sample verdict:", data);
  if (data.verdict !== "accept") {
    console.warn(
      "  (note: expected 'accept' for this obviously-correct answer — the key " +
        "works, but double-check the prompt wording if this persists.)"
    );
  }
}

main().catch((err) => {
  console.error("✗ Call failed:", err.status ? `${err.status} ` : "", err.message);
  process.exit(1);
});
