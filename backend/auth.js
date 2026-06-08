// Email-code sign-in (spec Phase 2). Codes are hashed at rest and sent
// via Resend when RESEND_API_KEY is set; printed to the console otherwise.
const crypto = require("crypto");
const db = require("./db.js");

const CODE_TTL_MINUTES = 10;
const SESSION_TTL_DAYS = 30;
const MAX_CODE_ATTEMPTS = 5;

const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");

// Password hashing with Node's built-in scrypt (salted, no extra deps).
// Stored as "salt:hash" hex.
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || !stored.includes(":")) return false;
  const [salt, hash] = stored.split(":");
  const candidate = crypto.scryptSync(password, salt, 64).toString("hex");
  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(candidate, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function issueSession(user) {
  const token = crypto.randomBytes(32).toString("hex");
  await db.query(`
    INSERT INTO sessions (user_id, token_hash, expires_at)
    VALUES ($1, $2, now() + interval '${SESSION_TTL_DAYS} days')
  `, [user.id, sha256(token)]);
  return token;
}

// Single email+password endpoint that signs up, logs in, or claims a
// legacy (password-less) account. Returns { token, user } or { error }.
async function passwordSignIn(email, password) {
  if (typeof password !== "string" || password.length < 6) {
    return { error: "Password must be at least 6 characters." };
  }

  let user = (
    await db.query("SELECT * FROM users WHERE email = $1", [email])
  ).rows[0];

  if (!user) {
    // New account.
    user = (
      await db.query(
        "INSERT INTO users (email, display_name, password_hash) VALUES ($1, $2, $3) RETURNING *",
        [email, await generateDisplayName(), hashPassword(password)]
      )
    ).rows[0];
  } else if (user.password_hash) {
    // Existing account with a password — verify it.
    if (!verifyPassword(password, user.password_hash)) {
      return { error: "Wrong password." };
    }
  } else {
    // Legacy account (created via email code, no password yet) — set one.
    await db.query(
      "UPDATE users SET password_hash = $1 WHERE id = $2",
      [hashPassword(password), user.id]
    );
  }

  const token = await issueSession(user);
  return { token, user: publicUser(user) };
}

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

async function generateDisplayName() {
  const first = NAME_FIRST[crypto.randomInt(NAME_FIRST.length)];
  const second = NAME_SECOND[crypto.randomInt(NAME_SECOND.length)];
  const name = `${first}${second}`;
  const { rows } = await db.query(
    "SELECT 1 FROM users WHERE display_name = $1", [name]
  );
  return rows.length ? `${name}${crypto.randomInt(10, 100)}` : name;
}

// Returns the updated user or { error }.
async function setDisplayName(user, rawName) {
  const name = String(rawName ?? "").trim().slice(0, 30);
  if (name.length < 2) return { error: "Name must be at least 2 characters." };

  await db.query(
    "UPDATE users SET display_name = $1 WHERE id = $2", [name, user.id]
  );
  return { user: publicUser({ ...user, display_name: name }) };
}

const normalizeEmail = (email) => String(email).trim().toLowerCase();

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

async function sendCode(email, code) {
  // Real delivery via Resend when a key is configured; console otherwise.
  if (process.env.RESEND_API_KEY) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: process.env.MAIL_FROM || "DotComma <onboarding@resend.dev>",
          to: [email],
          subject: `${code} is your DotComma sign-in code`,
          text:
            `Your DotComma sign-in code is: ${code}\n\n` +
            `It expires in ${CODE_TTL_MINUTES} minutes. ` +
            `If you didn't request this, you can ignore it.`
        })
      });
      if (res.ok) return;
      console.error("[auth] Resend error:", res.status, await res.text());
    } catch (err) {
      console.error("[auth] email send failed:", err.message);
    }
  }
  console.log(`[auth] sign-in code for ${email}: ${code}`);
}

async function startSignIn(email) {
  const code = crypto.randomInt(100000, 1000000).toString();

  // One active code per email at a time.
  await db.query("DELETE FROM login_codes WHERE email = $1", [email]);
  await db.query(`
    INSERT INTO login_codes (email, code_hash, expires_at)
    VALUES ($1, $2, now() + interval '${CODE_TTL_MINUTES} minutes')
  `, [email, sha256(code)]);

  await sendCode(email, code);
}

// Returns { token, user } on success, or { error } on failure.
async function verifySignIn(email, code) {
  const { rows } = await db.query(`
    SELECT * FROM login_codes
    WHERE email = $1 AND expires_at > now()
  `, [email]);
  const row = rows[0];

  if (!row) return { error: "Code expired or not requested. Start again." };

  if (row.attempts >= MAX_CODE_ATTEMPTS) {
    await db.query("DELETE FROM login_codes WHERE id = $1", [row.id]);
    return { error: "Too many attempts. Start again." };
  }

  if (sha256(String(code).trim()) !== row.code_hash) {
    await db.query(
      "UPDATE login_codes SET attempts = attempts + 1 WHERE id = $1", [row.id]
    );
    return { error: "Wrong code. Try again." };
  }

  await db.query("DELETE FROM login_codes WHERE id = $1", [row.id]);

  // Find or create the user; default display name is generated, not
  // email-derived (privacy).
  let user = (
    await db.query("SELECT * FROM users WHERE email = $1", [email])
  ).rows[0];
  if (!user) {
    user = (
      await db.query(
        "INSERT INTO users (email, display_name) VALUES ($1, $2) RETURNING *",
        [email, await generateDisplayName()]
      )
    ).rows[0];
  }

  const token = await issueSession(user);
  return { token, user: publicUser(user) };
}

// Resolve a request's Bearer token to a user, or null.
async function getUserForRequest(request) {
  const header = request.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;

  const { rows } = await db.query(`
    SELECT u.* FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = $1 AND s.expires_at > now()
  `, [sha256(token)]);
  const user = rows[0];

  if (user) {
    await db.query(
      "UPDATE users SET last_seen_at = now() WHERE id = $1", [user.id]
    );
  }
  return user || null;
}

async function signOut(request) {
  const header = request.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (token) {
    await db.query(
      "DELETE FROM sessions WHERE token_hash = $1", [sha256(token)]
    );
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
  passwordSignIn,
  getUserForRequest,
  signOut,
  setDisplayName,
  generateDisplayName,
  publicUser
};
