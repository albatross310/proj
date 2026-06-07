// Email-code sign-in (spec Phase 2). Codes are hashed at rest and, in dev,
// "sent" by printing to the server console. Swap sendCode for a real email
// provider (e.g. Resend) when deploying.
const crypto = require("crypto");
const db = require("./db.js");

const CODE_TTL_MINUTES = 10;
const SESSION_TTL_DAYS = 30;
const MAX_CODE_ATTEMPTS = 5;

const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");

// Default display names are generated, never derived from the email —
// an email local part (e.g. "petergibson127") is identifying (spec: privacy).
const NAME_FIRST = [
  "River", "Moss", "Fern", "Sun", "Moon", "Rain", "Cloud", "Reef",
  "Wave", "Sand", "Leaf", "Pine", "Stone", "Star", "Sea", "Hill"
];
const NAME_SECOND = [
  "Fox", "Wren", "Gull", "Frog", "Crab", "Owl", "Finch", "Koala",
  "Skink", "Ibis", "Roo", "Moth", "Carp", "Lark", "Newt", "Swan"
];

function generateDisplayName() {
  const first = NAME_FIRST[crypto.randomInt(NAME_FIRST.length)];
  const second = NAME_SECOND[crypto.randomInt(NAME_SECOND.length)];
  const name = `${first}${second}`;
  const taken = db.prepare("SELECT 1 FROM users WHERE display_name = ?")
    .get(name);
  return taken ? `${name}${crypto.randomInt(10, 100)}` : name;
}

// Returns the updated user or { error }.
function setDisplayName(user, rawName) {
  const name = String(rawName ?? "").trim().slice(0, 30);
  if (name.length < 2) return { error: "Name must be at least 2 characters." };

  db.prepare("UPDATE users SET display_name = ? WHERE id = ?")
    .run(name, user.id);
  return { user: publicUser({ ...user, display_name: name }) };
}

const normalizeEmail = (email) => String(email).trim().toLowerCase();

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

function sendCode(email, code) {
  // Dev stand-in for email delivery.
  console.log(`[auth] sign-in code for ${email}: ${code}`);
}

function startSignIn(email) {
  const code = crypto.randomInt(100000, 1000000).toString();

  // One active code per email at a time.
  db.prepare("DELETE FROM login_codes WHERE email = ?").run(email);
  db.prepare(`
    INSERT INTO login_codes (email, code_hash, expires_at)
    VALUES (?, ?, datetime('now', '+${CODE_TTL_MINUTES} minutes'))
  `).run(email, sha256(code));

  sendCode(email, code);
}

// Returns { token, user } on success, or { error } on failure.
function verifySignIn(email, code) {
  const row = db.prepare(`
    SELECT * FROM login_codes
    WHERE email = ? AND expires_at > datetime('now')
  `).get(email);

  if (!row) return { error: "Code expired or not requested. Start again." };

  if (row.attempts >= MAX_CODE_ATTEMPTS) {
    db.prepare("DELETE FROM login_codes WHERE id = ?").run(row.id);
    return { error: "Too many attempts. Start again." };
  }

  if (sha256(String(code).trim()) !== row.code_hash) {
    db.prepare("UPDATE login_codes SET attempts = attempts + 1 WHERE id = ?")
      .run(row.id);
    return { error: "Wrong code. Try again." };
  }

  db.prepare("DELETE FROM login_codes WHERE id = ?").run(row.id);

  // Find or create the user; default display name is generated, not
  // email-derived (privacy).
  let user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  if (!user) {
    const result = db.prepare(
      "INSERT INTO users (email, display_name) VALUES (?, ?)"
    ).run(email, generateDisplayName());
    user = db.prepare("SELECT * FROM users WHERE id = ?")
      .get(result.lastInsertRowid);
  }

  const token = crypto.randomBytes(32).toString("hex");
  db.prepare(`
    INSERT INTO sessions (user_id, token_hash, expires_at)
    VALUES (?, ?, datetime('now', '+${SESSION_TTL_DAYS} days'))
  `).run(user.id, sha256(token));

  return { token, user: publicUser(user) };
}

// Resolve a request's Bearer token to a user, or null.
function getUserForRequest(request) {
  const header = request.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;

  const user = db.prepare(`
    SELECT u.* FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > datetime('now')
  `).get(sha256(token));

  if (user) {
    db.prepare("UPDATE users SET last_seen_at = datetime('now') WHERE id = ?")
      .run(user.id);
  }
  return user || null;
}

function signOut(request) {
  const header = request.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (token) {
    db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(sha256(token));
  }
}

// Never expose email beyond the account owner's own /api/me response.
const publicUser = (user) => ({
  email: user.email,
  displayName: user.display_name
});

module.exports = {
  normalizeEmail,
  isValidEmail,
  startSignIn,
  verifySignIn,
  getUserForRequest,
  signOut,
  setDisplayName,
  generateDisplayName,
  publicUser
};
