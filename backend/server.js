require("./env.js"); // load .env for local dev (Render injects env directly)
const Fastify = require("fastify");
const { Server } = require("socket.io");
const db = require("./db.js");
const { validateText } = require("./words.js");
const auth = require("./auth.js");

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

// Guard an auth route: caps attempts per IP (and optionally per email) over a
// window. Replies 429 and returns false when over the limit.
function authRateLimit(request, reply, email) {
  const route = request.routeOptions?.url || request.url;
  const ipOk = rateLimit(`ip:${request.ip}:${route}`, 20, 10 * 60 * 1000);
  const emailOk = email
    ? rateLimit(`email:${email}:${route}`, 5, 10 * 60 * 1000)
    : true;
  if (!ipOk || !emailOk) {
    reply.code(429).send({ error: "Too many attempts. Try again later." });
    return false;
  }
  return true;
}

app.get("/", async () => ({ ok: true }));

// --- Auth (spec Phase 2): email-code sign-in ---

app.post("/api/auth/start", async (request, reply) => {
  const email = auth.normalizeEmail(request.body?.email || "");
  if (!auth.isValidEmail(email)) {
    return reply.code(400).send({ error: "Enter a valid email address." });
  }
  if (!authRateLimit(request, reply, email)) return;
  await auth.startSignIn(email);
  return { ok: true };
});

app.post("/api/auth/verify", async (request, reply) => {
  const email = auth.normalizeEmail(request.body?.email || "");
  const code = request.body?.code;
  if (!auth.isValidEmail(email) || !code) {
    return reply.code(400).send({ error: "Email and code are required." });
  }
  if (!authRateLimit(request, reply, email)) return;
  const result = await auth.verifySignIn(email, code);
  if (result.error) return reply.code(401).send({ error: result.error });
  return result;
});

// Email + password: signs up, logs in, or sets a password on a
// legacy code-only account.
app.post("/api/auth/password", async (request, reply) => {
  const email = auth.normalizeEmail(request.body?.email || "");
  const password = request.body?.password;
  if (!auth.isValidEmail(email)) {
    return reply.code(400).send({ error: "Enter a valid email address." });
  }
  if (!authRateLimit(request, reply, email)) return;
  const result = await auth.passwordSignIn(email, password);
  if (result.error) return reply.code(401).send({ error: result.error });
  return result;
});

// Forgot password: email a reset code, then set a new password with it.
// /start always returns ok (never reveals whether the email has an account).
app.post("/api/auth/forgot/start", async (request, reply) => {
  const email = auth.normalizeEmail(request.body?.email || "");
  if (!auth.isValidEmail(email)) {
    return reply.code(400).send({ error: "Enter a valid email address." });
  }
  if (!authRateLimit(request, reply, email)) return;
  await auth.requestPasswordReset(email);
  return { ok: true };
});

app.post("/api/auth/forgot/reset", async (request, reply) => {
  const email = auth.normalizeEmail(request.body?.email || "");
  const { code, password } = request.body || {};
  if (!auth.isValidEmail(email) || !code) {
    return reply.code(400).send({ error: "Email and code are required." });
  }
  if (!authRateLimit(request, reply, email)) return;
  const result = await auth.resetPassword(email, code, password);
  if (result.error) return reply.code(401).send({ error: result.error });
  return result;
});

app.get("/api/me", async (request, reply) => {
  const user = await auth.getUserForRequest(request);
  if (!user) return reply.code(401).send({ error: "Not signed in." });
  return { user: auth.publicUser(user) };
});

app.post("/api/auth/signout", async (request) => {
  await auth.signOut(request);
  return { ok: true };
});

// Change the signed-in user's display name (Settings).
app.post("/api/me/display-name", async (request, reply) => {
  const user = await auth.getUserForRequest(request);
  if (!user) return reply.code(401).send({ error: "Not signed in." });

  const result = await auth.setDisplayName(user, request.body?.displayName);
  if (result.error) return reply.code(400).send({ error: result.error });
  return result;
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
  const { promptKey, answerText, visibility, anonymousName } = request.body || {};

  if (!promptKey || typeof promptKey !== "string") {
    return reply.code(400).send({ error: "promptKey is required" });
  }
  if (!answerText || typeof answerText !== "string" || !answerText.trim()) {
    return reply.code(400).send({ error: "answerText is required" });
  }

  const validation = validateText(answerText);

  // Simple MVP score per spec: all words valid = +10, small bonus for brevity.
  const score = validation.allValid
    ? 10 + Math.max(0, 10 - validation.validCount)
    : 0;

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

  // Rotating playful results title (frontend holds the actual strings).
  const outcome = validation.allValid ? "win" : "lose";
  const poolSize = outcome === "win"
    ? request.body.winCount
    : request.body.loseCount;
  const resultMessageIndex = await nextMessageIndex(outcome, poolSize);

  return { answer: rows[0], validation, outcome, resultMessageIndex };
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
