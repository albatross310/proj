const Fastify = require("fastify");  // s1
const { Server } = require("socket.io");  // s1
const db = require("./db.js");
const { validateText } = require("./words.js");

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

  const result = db.prepare(`
    INSERT INTO answers
      (prompt_key, anonymous_name, answer_text,
       valid_word_count, invalid_word_count, all_words_valid,
       score, visibility)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    promptKey,
    typeof anonymousName === "string" && anonymousName.trim()
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

app.listen({port: 3000, host: "0.0.0.0" }, () => {  // s1
    console.log("http://localhost:3000");
});
