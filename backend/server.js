const Fastify = require("fastify");  // s1
const { Server } = require("socket.io");  // s1
const db = require("./db.js");
const { validateText } = require("./words.js");
const auth = require("./auth.js");

const app = Fastify();  // s1

app.register(require("@fastify/cors"), {  // s1
    origin: "*"
});

const server = app.server;  // s1
const io = new Server(server, {  // s1
    cors: { origin: "*" }
});

io.on("connection", (socket) => {  // s1
  console.log("client connected");

  socket.on("validate_text", (text) => {
    socket.emit("validation_result", validateText(text).words);
  });
});

app.get("/", async () => ({ ok: true}));  // s1

// --- Auth (spec Phase 2): email-code sign-in ---

app.post("/api/auth/start", async (request, reply) => {
  const email = auth.normalizeEmail(request.body?.email || "");
  if (!auth.isValidEmail(email)) {
    return reply.code(400).send({ error: "Enter a valid email address." });
  }
  auth.startSignIn(email);
  return { ok: true };
});

app.post("/api/auth/verify", async (request, reply) => {
  const email = auth.normalizeEmail(request.body?.email || "");
  const code = request.body?.code;
  if (!auth.isValidEmail(email) || !code) {
    return reply.code(400).send({ error: "Email and code are required." });
  }
  const result = auth.verifySignIn(email, code);
  if (result.error) return reply.code(401).send({ error: result.error });
  return result;
});

app.get("/api/me", async (request, reply) => {
  const user = auth.getUserForRequest(request);
  if (!user) return reply.code(401).send({ error: "Not signed in." });
  return { user: auth.publicUser(user) };
});

app.post("/api/auth/signout", async (request) => {
  auth.signOut(request);
  return { ok: true };
});

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
  const user = auth.getUserForRequest(request);

  const result = db.prepare(`
    INSERT INTO answers
      (prompt_key, user_id, anonymous_name, answer_text,
       valid_word_count, invalid_word_count, all_words_valid,
       score, visibility)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
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
  );

  const answer = db.prepare("SELECT * FROM answers WHERE id = ?")
    .get(result.lastInsertRowid);

  return { answer, validation };
});

// Public top answers for a prompt, best score first then newest.
// Only exposes display-safe fields (spec: never expose email/user ids).
app.get("/api/prompts/:promptKey/top-answers", async (request) => {
  const answers = db.prepare(`
    SELECT a.id,
           COALESCE(u.display_name, a.anonymous_name) AS anonymous_name,
           a.answer_text, a.all_words_valid, a.score, a.created_at
    FROM answers a
    LEFT JOIN users u ON u.id = a.user_id
    WHERE a.prompt_key = ? AND a.visibility = 'public'
    ORDER BY a.score DESC, a.created_at DESC
    LIMIT 10
  `).all(request.params.promptKey);

  return { answers };
});

app.listen({port: 3000, host: "0.0.0.0" }, () => {  // s1
    console.log("http://localhost:3000");
});
