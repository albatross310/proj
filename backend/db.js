const Database = require("better-sqlite3");
const path = require("path");

const db = new Database(path.join(__dirname, "data.db"));
db.pragma("journal_mode = WAL");

// answers table per DotComma build spec (Phase 1).
// user_id stays nullable until accounts exist (Phase 2).
db.exec(`
  CREATE TABLE IF NOT EXISTS answers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prompt_key TEXT NOT NULL,
    user_id INTEGER,
    anonymous_name TEXT,
    answer_text TEXT NOT NULL,
    valid_word_count INTEGER NOT NULL DEFAULT 0,
    invalid_word_count INTEGER NOT NULL DEFAULT 0,
    all_words_valid INTEGER NOT NULL DEFAULT 0,
    score INTEGER NOT NULL DEFAULT 0,
    visibility TEXT NOT NULL DEFAULT 'public',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_answers_prompt_key
    ON answers (prompt_key);
`);

module.exports = db;
