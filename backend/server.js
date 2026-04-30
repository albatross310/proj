const Fastify = require("fastify");  // s1
const { Server } = require("socket.io");  // s1

const app = Fastify();  // s1

app.register(require("@fastify/cors"), {  // s1
    origin: "*"
});

const server = app.server;  // s1
const io = new Server(server, {  // s1
    cors: { origin: "*" }
});

const allowedWords = new Set([  // s1
  "i", "you", "we", "they",
  "be", "am", "is", "are", "was",
  "do", "did", "not", "no",
  "can", "will", "go", "see", "say",
  "good", "bad", "big", "small"
]);

io.on("connection", (socket) => {  // s1
  console.log("client connected");

  socket.on("validate_text", (text) => {
    const words = text.toLowerCase().match(/[a-z]+/g) || [];

    socket.emit(
      "validation_result",
      words.map((word) => ({
        word,
        valid: allowedWords.has(word),
      }))
    );
  });
});
app.get("/", async () => ({ ok: true}));  // s1

app.listen({port: 3000, host: "0.0.0.0" }, () => {  // s1
    console.log("http://localhost:3000");
});
