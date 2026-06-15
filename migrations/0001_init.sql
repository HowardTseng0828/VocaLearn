-- VocaLearn D1 schema (idempotent).

-- Master vocabulary list (shared across all users). Seeded from data/seed-words.sql.
CREATE TABLE IF NOT EXISTS words (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  word    TEXT NOT NULL UNIQUE,
  pos     TEXT NOT NULL DEFAULT '',
  meaning TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_words_word ON words(word);

-- User accounts. Passwords are PBKDF2-hashed (see functions/_lib/auth.ts).
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name  TEXT NOT NULL DEFAULT '',
  created_at    INTEGER NOT NULL
);

-- Opaque session tokens (cookie-based). Deleted on logout / expiry.
CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- Per-user mastery of each word (spaced-repetition-lite).
CREATE TABLE IF NOT EXISTS progress (
  user_id     INTEGER NOT NULL,
  word_id     INTEGER NOT NULL,
  seen        INTEGER NOT NULL DEFAULT 0,   -- times tested
  correct     INTEGER NOT NULL DEFAULT 0,   -- times answered correctly
  streak      INTEGER NOT NULL DEFAULT 0,   -- current correct streak
  mastered    INTEGER NOT NULL DEFAULT 0,   -- 1 once streak >= 3
  last_seen   INTEGER,                      -- epoch ms of last test
  PRIMARY KEY (user_id, word_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_progress_user ON progress(user_id);

-- Wrong-answer notebook. resolved=1 once the user later answers it correctly.
CREATE TABLE IF NOT EXISTS wrong_answers (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  word_id     INTEGER NOT NULL,
  mode        TEXT NOT NULL,                -- en2zh | zh2en | spell | cloze
  your_answer TEXT NOT NULL DEFAULT '',
  created_at  INTEGER NOT NULL,
  resolved    INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_wrong_user ON wrong_answers(user_id, resolved);

-- Daily activity log — one row per user per day, for streaks & the heatmap.
CREATE TABLE IF NOT EXISTS daily_activity (
  user_id   INTEGER NOT NULL,
  day       TEXT NOT NULL,                  -- 'YYYY-MM-DD' (UTC)
  answered  INTEGER NOT NULL DEFAULT 0,
  correct   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
