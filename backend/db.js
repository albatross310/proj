// Postgres (Supabase) connection + schema. DATABASE_URL is the Supabase
// "Session pooler" connection string — from .env locally, from the host's
// dashboard in production.
//
// Authentication itself is handled by Supabase Auth (the client signs in and
// the backend verifies the JWT — see auth.js). The `users` table here is just
// a profile row per Supabase user, keyed to the auth user by `auth_id`; it
// holds the display name and is what `answers.user_id` references.
require("./env.js");
const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
  console.error(
    "DATABASE_URL is not set — copy backend/.env.example to backend/.env and " +
    "add your Supabase Session-pooler connection string."
  );
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Supabase requires TLS
  max: 5
});

// The pooler drops idle connections; without this listener an error emitted on
// an idle client is an unhandled 'error' event that can take the process down.
pool.on("error", (err) => {
  console.error("[db] idle client error:", err.message);
});

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      auth_id UUID UNIQUE,
      email TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    -- Link to the Supabase Auth user (added when migrating to Supabase Auth).
    ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_id UUID;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_auth_id ON users (auth_id);

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

    -- AI judge verdict (see ai-judge.js). Filled in asynchronously after the
    -- answer is stored — Haiku -> Sonnet -> Opus cascade, e-mail for the rest.
    --   ai_verdict     'accept' | 'reject' | 'unsure' | 'error' | NULL (pending)
    --   ai_tier        which model settled it: 'haiku' | 'sonnet' | 'opus' | 'error'
    --   ai_confidence  0-100, the model's stated confidence
    --   ai_reason      one-line justification
    ALTER TABLE answers ADD COLUMN IF NOT EXISTS ai_verdict TEXT;
    ALTER TABLE answers ADD COLUMN IF NOT EXISTS ai_tier TEXT;
    ALTER TABLE answers ADD COLUMN IF NOT EXISTS ai_confidence INTEGER;
    ALTER TABLE answers ADD COLUMN IF NOT EXISTS ai_reason TEXT;
    ALTER TABLE answers ADD COLUMN IF NOT EXISTS ai_judged_at TIMESTAMPTZ;

    CREATE INDEX IF NOT EXISTS idx_answers_prompt_key ON answers (prompt_key);
    CREATE INDEX IF NOT EXISTS idx_answers_user_id ON answers (user_id);

    CREATE TABLE IF NOT EXISTS answer_votes (
      id SERIAL PRIMARY KEY,
      answer_id INTEGER NOT NULL REFERENCES answers(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (answer_id, user_id)
    );

    -- The top-answers query LEFT JOINs + GROUPs votes by answer_id, so index it.
    CREATE INDEX IF NOT EXISTS idx_answer_votes_answer_id ON answer_votes (answer_id);

    -- Tracks the last-shown result-message index per outcome ('win'/'lose')
    -- so the playful titles rotate randomly without repeating back to back.
    CREATE TABLE IF NOT EXISTS message_state (
      outcome TEXT PRIMARY KEY,
      last_index INTEGER NOT NULL DEFAULT -1
    );

    -- Retire the custom-auth tables/column — Supabase Auth owns credentials now.
    DROP TABLE IF EXISTS sessions;
    DROP TABLE IF EXISTS login_codes;
    ALTER TABLE users DROP COLUMN IF EXISTS password_hash;
  `);
}

const query = (text, params) => pool.query(text, params);

module.exports = { pool, query, init };
