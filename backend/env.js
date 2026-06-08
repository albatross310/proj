// Minimal .env loader — no dependency needed. Lines of KEY=value;
// existing environment variables win. Used for local dev only
// (Render injects env vars directly).
const fs = require("fs");
const path = require("path");

try {
  const lines = fs
    .readFileSync(path.join(__dirname, ".env"), "utf8")
    .split("\n");
  for (const line of lines) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
} catch {
  // no .env file — fine
}
