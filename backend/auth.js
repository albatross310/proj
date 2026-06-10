// Authentication is handled by Supabase Auth on the client. The backend's job
// is only to (1) verify the Supabase access token (JWT) sent as a Bearer token,
// and (2) map the Supabase user (a UUID) to a row in our own `users` table,
// which holds the display name and is what `answers.user_id` references.
//
// The token is a standard HS256 JWT signed with the project's JWT secret
// (Supabase dashboard -> Settings -> API -> JWT Secret), verified locally with
// Node's crypto so there's no per-request network call and no extra dependency.
const crypto = require("crypto");
const db = require("./db.js");

const JWT_SECRET = process.env.SUPABASE_JWT_SECRET || "";
if (!JWT_SECRET) {
  console.warn(
    "[auth] SUPABASE_JWT_SECRET is not set — all requests will be treated as " +
    "anonymous. Set it from Supabase: Settings -> API -> JWT Secret."
  );
}

// Verify an HS256 JWT and return its payload, or null if invalid/expired.
function verifyJwt(token) {
  if (!JWT_SECRET) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [h, p, sig] = parts;

  const expected = crypto.createHmac("sha256", JWT_SECRET).update(`${h}.${p}`).digest();
  let given;
  try {
    given = Buffer.from(sig, "base64url");
  } catch {
    return null;
  }
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) {
    return null;
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(p, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (payload.exp && Math.floor(Date.now() / 1000) >= payload.exp) return null;
  return payload;
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

// Resolve a request's Supabase access token to our local user row, creating
// (or linking, by email) the row on first sight. Returns the user or null.
async function getUserForRequest(request) {
  const header = request.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;

  const payload = verifyJwt(token);
  if (!payload || !payload.sub) return null;

  const authId = payload.sub;            // Supabase user UUID
  const email = payload.email || null;

  let user = (
    await db.query("SELECT * FROM users WHERE auth_id = $1", [authId])
  ).rows[0];

  if (!user) {
    // First time we've seen this Supabase user. Insert a profile row; if a
    // legacy row already exists for the same email (pre-Supabase account),
    // link it by setting its auth_id instead of creating a duplicate.
    user = (
      await db.query(
        `INSERT INTO users (auth_id, email, display_name)
         VALUES ($1, $2, $3)
         ON CONFLICT (email) DO UPDATE SET auth_id = EXCLUDED.auth_id
         RETURNING *`,
        [authId, email, await generateDisplayName()]
      )
    ).rows[0];
  }

  return user || null;
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

// Never expose email beyond the account owner's own /api/me response.
const publicUser = (user) => ({
  email: user.email,
  displayName: user.display_name
});

module.exports = {
  getUserForRequest,
  setDisplayName,
  generateDisplayName,
  publicUser
};
