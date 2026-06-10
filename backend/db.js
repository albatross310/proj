// Postgres (Neon) connection + schema. DATABASE_URL comes from .env
// locally and from the Render dashboard in production.
require("./env.js");
const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
  console.error(
    "DATABASE_URL is not set — copy backend/.env.example to backend/.env " +
    "and add your Neon connection string."
  );
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Neon requires TLS
  max: 5
});

// Neon drops idle connections; without this listener an error emitted on an
// idle client is an unhandled 'error' event that can take the process down.
pool.on("error", (err) => {
  console.error("[db] idle client error:", err.message);
});

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS answers (
      id SERIAL PRIMARY KEY,
      prompt_key TEXT NOT NULL,
      user_id INTEGER REFERENCES users(id),
      anonymous_name TEXT,
      answer_text TEXT NOT NULL,
      valid_word_count INTEGER NOT NULL DEFAULT 0,
      invalid_word_count INTEGER NOT NULL DEFAULT 0,
      all_words_valid INTEGER NOT NULL DEFAULT 0,
      score INTEGER NOT NULL DEFAULT 0,
      visibility TEXT NOT NULL DEFAULT 'public',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_answers_prompt_key
      ON answers (prompt_key);

    CREATE TABLE IF NOT EXISTS sessions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      token_hash TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      expires_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE IF NOT EXISTS answer_votes (
      id SERIAL PRIMARY KEY,
      answer_id INTEGER NOT NULL REFERENCES answers(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (answer_id, user_id)
    );

    -- The top-answers query LEFT JOINs + GROUPs votes by answer_id, so index it.
    -- (The UNIQUE(answer_id,user_id) index is leading-column answer_id too, but
    -- a dedicated single-column index keeps the planner's choice obvious.)
    CREATE INDEX IF NOT EXISTS idx_answer_votes_answer_id
      ON answer_votes (answer_id);

    -- FK lookups used when joining answers -> users and listing a user's sessions.
    CREATE INDEX IF NOT EXISTS idx_answers_user_id ON answers (user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id);
    CREATE INDEX IF NOT EXISTS idx_login_codes_email ON login_codes (email);

    CREATE TABLE IF NOT EXISTS login_codes (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    -- Tracks the last-shown result-message index per outcome ('win'/'lose')
    -- so the playful titles rotate randomly without repeating back to back.
    CREATE TABLE IF NOT EXISTS message_state (
      outcome TEXT PRIMARY KEY,
      last_index INTEGER NOT NULL DEFAULT -1
    );

    -- Optional password sign-in (added after users table first shipped).
    ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
  `);
}

const query = (text, params) => pool.query(text, params);

module.exports = { pool, query, init };
