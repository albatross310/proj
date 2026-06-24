require("./env.js"); // load .env for local dev (Render injects env directly)
const Fastify = require("fastify");
const { Server } = require("socket.io");
const db = require("./db.js");
const { validateText } = require("./words.js");
const auth = require("./auth.js");
const aiJudge = require("./ai-judge.js");

// Prompt deck, generated from content/prompts.txt (see scripts/build-content.mjs).
const prompts = require("./shared/prompts.json");
const promptsByKey = new Map(prompts.map((p) => [p.key, p]));

const app = Fastify();

// CORS allowlist. Defaults to the known DotComma origins (+ any *.vercel.app
// preview deploy and localhost); override with CORS_ORIGINS="a,b,c" or "*".
const CORS_ORIGINS =
  process.env.CORS_ORIGINS ||
  "https://dotcomma.com.au,https://www.dotcomma.com.au,https://dotcomma.vercel.app,http://localhost:5173,http://localhost:3000";
const allowList = CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean);

function isAllowedOrigin(origin) {
  if (CORS_ORIGINS === "*") return true;
  if (!origin) return true; // same-origin / curl / server-to-server
  if (allowList.includes(origin)) return true;
  try {
    return /(^|\.)vercel\.app$/.test(new URL(origin).hostname);
  } catch {
    return false;
  }
}

app.register(require("@fastify/cors"), {
  origin: (origin, cb) => cb(null, isAllowedOrigin(origin))
});

const server = app.server;
const io = new Server(server, {
  cors: { origin: (origin, cb) => cb(null, isAllowedOrigin(origin)) }
});

// Live typing validation. The result is authoritative (the same word list the
// /api/answers scorer uses), so the client can colour against the server rather
// than only its bundled copy — see the frontend's getColor fallback.
io.on("connection", (socket) => {
  socket.on("validate_text", (text) => {
    socket.emit("validation_result", validateText(text).words);
  });
});

// --- Simple in-memory rate limiter (no dependency). Sliding window per key;
// good enough for a single-instance deploy. Returns true when allowed. ---
const rateBuckets = new Map();
function rateLimit(key, max, windowMs) {
  const now = Date.now();
  const hits = (rateBuckets.get(key) || []).filter((t) => now - t < windowMs);
  hits.push(now);
  rateBuckets.set(key, hits);
  return hits.length <= max;
}
// Drop stale buckets periodically so the Map can't grow unbounded.
setInterval(() => {
  const now = Date.now();
  for (const [key, hits] of rateBuckets) {
    if (hits.every((t) => now - t > 15 * 60 * 1000)) rateBuckets.delete(key);
  }
}, 10 * 60 * 1000).unref();

app.get("/", async () => ({ ok: true }));

// AI judge health. GET /api/health/ai reports whether the key is configured and
// the current Opus-queue depth. Add ?test=1 to run one real Haiku judgement and
// confirm the key actually works (returns the verdict, or the API error).
app.get("/api/health/ai", async (request) => {
  const base = { enabled: aiJudge.enabled, queueDepth: aiJudge.queueDepth() };
  if (request.query.test === "1") {
    return { ...base, selfTest: await aiJudge.selfTest() };
  }
  return base;
});

// Auth is handled by Supabase Auth on the client (sign-in / sign-up / password
// reset all happen there). The backend just verifies the Supabase access token
// (auth.getUserForRequest) and maps it to a profile row. There are no auth
// endpoints here any more.

app.get("/api/me", async (request, reply) => {
  const user = await auth.getUserForRequest(request);
  if (!user) return reply.code(401).send({ error: "Not signed in." });
  return { user: auth.publicUser(user) };
});

// Change the signed-in user's display name (Settings).
app.post("/api/me/display-name", async (request, reply) => {
  const user = await auth.getUserForRequest(request);
  if (!user) return reply.code(401).send({ error: "Not signed in." });

  const result = await auth.setDisplayName(user, request.body?.displayName);
  if (result.error) return reply.code(400).send({ error: result.error });
  return result;
});

// The signed-in user's own answers, newest first (My Answers page).
// Only their rows, only display-safe fields.
app.get("/api/me/answers", async (request, reply) => {
  const user = await auth.getUserForRequest(request);
  if (!user) return reply.code(401).send({ error: "Not signed in." });

  const { rows } = await db.query(`
    SELECT id, prompt_key, answer_text, all_words_valid, score, visibility, created_at,
           ai_verdict, ai_tier, ai_confidence, ai_reason
    FROM answers
    WHERE user_id = $1
    ORDER BY created_at DESC, id DESC
    LIMIT 200
  `, [user.id]);

  return { answers: rows };
});

// Pick the next playful-message index for an outcome: random, but never
// the same as the last one shown, and the position persists in the DB so
// the rotation continues across reloads and players.
async function nextMessageIndex(outcome, poolSize) {
  const size = Number(poolSize);
  if (!Number.isInteger(size) || size < 1) return 0;

  const { rows } = await db.query(
    "SELECT last_index FROM message_state WHERE outcome = $1", [outcome]
  );
  const last = rows.length ? rows[0].last_index : -1;

  let idx = 0;
  if (size > 1) {
    do {
      idx = Math.floor(Math.random() * size);
    } while (idx === last);
  }

  await db.query(`
    INSERT INTO message_state (outcome, last_index) VALUES ($1, $2)
    ON CONFLICT (outcome) DO UPDATE SET last_index = EXCLUDED.last_index
  `, [outcome, idx]);

  return idx;
}

// Submit an answer: validate server-side (authoritative), store, return both.
app.post("/api/answers", async (request, reply) => {
  // Light anti-spam: cap submissions per IP.
  if (!rateLimit(`answers:${request.ip}`, 30, 60 * 1000)) {
    return reply.code(429).send({ error: "Slow down a moment and try again." });
  }

  const { promptKey, answerText, visibility, anonymousName } = request.body || {};

  if (!promptKey || typeof promptKey !== "string") {
    return reply.code(400).send({ error: "promptKey is required" });
  }
  if (!answerText || typeof answerText !== "string" || !answerText.trim()) {
    return reply.code(400).send({ error: "answerText is required" });
  }

  // Only accept answers for prompts that exist in the deck, so a stale
  // client can't write rows under a key no prompt will ever show again.
  const prompt = promptsByKey.get(promptKey);
  if (!prompt) {
    return reply.code(400).send({ error: "Unknown promptKey." });
  }

  const validation = validateText(answerText);

  // Score per spec: all words valid = +10, small bonus for brevity,
  // and +5 when the answer matches the prompt's correct/accepted answers.
  const norm = (s) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const exact = [prompt.correct, ...prompt.answers]
    .filter(Boolean)
    .some((a) => norm(a) === norm(answerText));
  const score =
    (validation.allValid ? 10 + Math.max(0, 10 - validation.validCount) : 0) +
    (exact ? 5 : 0);

  // Private unless the client explicitly opts in (spec: privacy-safe default).
  const vis = visibility === "public" ? "public" : "private";

  // Attach the answer to the signed-in user when a valid token is sent.
  const user = await auth.getUserForRequest(request);

  const { rows } = await db.query(`
    INSERT INTO answers
      (prompt_key, user_id, anonymous_name, answer_text,
       valid_word_count, invalid_word_count, all_words_valid,
       score, visibility)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *
  `, [
    promptKey,
    user ? user.id : null,
    user
      ? user.display_name
      : typeof anonymousName === "string" && anonymousName.trim()
        ? anonymousName.trim().slice(0, 40)
        : "Anonymous player",
    answerText.trim(),
    validation.validCount,
    validation.invalidCount,
    validation.allValid ? 1 : 0,
    score,
    vis
  ]);

  // AI judge: decides whether the rewrite captures the prompt's meaning. The
  // fast Haiku pass is awaited so the player sees a verdict immediately on the
  // results screen; if Haiku is unsure it escalates to Sonnet -> Opus in the
  // background, writing the final verdict back onto the row (ai_verdict/...).
  // A timeout guards against a slow/hung call ever blocking the submission —
  // the judge keeps running and persisting in the background either way.
  const ai = await Promise.race([
    aiJudge.judgeNewAnswer(rows[0]),
    new Promise((resolve) => setTimeout(() => resolve(null), 12000))
  ]).catch((err) => {
    console.error("[ai-judge]", err.message);
    return null;
  });

  // Combined result: an answer only WINS when its words are all valid AND the
  // AI accepts the meaning. The word list and the meaning check are separate
  // gates, so we report a precise status the results screen can act on:
  //   "lose"     — words off-list (fails regardless of meaning)
  //   "rejected" — words ok, but the AI says the meaning is wrong (-> Contest)
  //   "review"   — words ok, AI unsure; escalating to Sonnet/Opus in background
  //   "win"      — words ok AND AI accepts (or the AI is unavailable: we don't
  //                block a clean answer on our own outage)
  const aiVerdict = ai ? ai.verdict : null;
  let status;
  if (!validation.allValid) status = "lose";
  else if (aiVerdict === "reject") status = "rejected";
  else if (aiVerdict === "unsure") status = "review";
  else status = "win"; // "accept", "error", or AI unavailable (null)

  // Rotating playful title still uses the win/lose pools; "rejected"/"review"
  // get their own copy on the client, so they draw from the lose pool here.
  const outcome = status === "win" ? "win" : "lose";
  const poolSize = outcome === "win"
    ? request.body.winCount
    : request.body.loseCount;
  const resultMessageIndex = await nextMessageIndex(outcome, poolSize);

  return { answer: rows[0], validation, outcome, status, resultMessageIndex, ai };
});

// Public top answers for a prompt, with like counts.
// ?sort=points (default: score, then newest) or ?sort=recent.
// Sends likedByMe when called with a valid session token.
// Only exposes display-safe fields (spec: never expose email/user ids).
app.get("/api/prompts/:promptKey/top-answers", async (request) => {
  const me = await auth.getUserForRequest(request);
  const orderBy =
    request.query.sort === "recent"
      ? "a.created_at DESC, a.id DESC"
      : "a.score DESC, a.created_at DESC, a.id DESC";

  const { rows } = await db.query(`
    SELECT a.id,
           COALESCE(u.display_name, a.anonymous_name) AS anonymous_name,
           a.answer_text, a.all_words_valid, a.score, a.created_at,
           COUNT(v.id)::int AS likes,
           MAX(CASE WHEN v.user_id = $1 THEN 1 ELSE 0 END)::int AS "likedByMe"
    FROM answers a
    LEFT JOIN users u ON u.id = a.user_id
    LEFT JOIN answer_votes v ON v.answer_id = a.id
    WHERE a.prompt_key = $2 AND a.visibility = 'public'
    GROUP BY a.id, u.display_name
    ORDER BY ${orderBy}
    LIMIT 7
  `, [me ? me.id : -1, request.params.promptKey]);

  return { answers: rows };
});

// Toggle a like on an answer. Signed-in users only (spec Phase 6).
app.post("/api/answers/:answerId/like", async (request, reply) => {
  const me = await auth.getUserForRequest(request);
  if (!me) return reply.code(401).send({ error: "Sign in to like answers." });

  const answer = (
    await db.query(
      "SELECT id FROM answers WHERE id = $1 AND visibility = 'public'",
      [request.params.answerId]
    )
  ).rows[0];
  if (!answer) return reply.code(404).send({ error: "Answer not found." });

  const existing = (
    await db.query(
      "SELECT id FROM answer_votes WHERE answer_id = $1 AND user_id = $2",
      [answer.id, me.id]
    )
  ).rows[0];

  if (existing) {
    await db.query("DELETE FROM answer_votes WHERE id = $1", [existing.id]);
  } else {
    await db.query(
      "INSERT INTO answer_votes (answer_id, user_id) VALUES ($1, $2)",
      [answer.id, me.id]
    );
  }

  const likes = (
    await db.query(
      "SELECT COUNT(*)::int AS likes FROM answer_votes WHERE answer_id = $1",
      [answer.id]
    )
  ).rows[0].likes;

  return { liked: !existing, likes };
});

// Dev-only: browse all stored answers in the browser.
// Disabled in production (set NODE_ENV=production when deploying).
// Emails are masked by default; append ?full=1 to see them unmasked.
if (process.env.NODE_ENV !== "production") {
  const maskEmail = (email) => (email ? "***@***" : null);

  app.get("/api/dev/answers", async (request) => {
    const { rows } = await db.query(`
      SELECT a.*, u.display_name, u.email
      FROM answers a
      LEFT JOIN users u ON u.id = a.user_id
      ORDER BY a.id DESC
    `);

    if (request.query.full !== "1") {
      for (const row of rows) row.email = maskEmail(row.email);
    }
    return { answers: rows };
  });
}

const PORT = process.env.PORT || 3000;

db.init()
  .then(() => {
    app.listen({ port: PORT, host: "0.0.0.0" }, () => {
      console.log(`http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Database init failed:", err);
    process.exit(1);
  });
