-- 0009: multi-language courses, server-issued quiz sessions, AI card cache,
-- per-user stats counters, and rate limits.
--
-- Back up before applying to production:
--   npx wrangler d1 export vocalearn-db --remote --output=backup-before-0009.sql
--
-- words gains a target language (lang). Its old UNIQUE(word) constraint has to
-- become UNIQUE(lang, word), which SQLite can only do by rebuilding the table.
-- Dropping words would cascade-delete progress and wrong_answers (D1 always
-- enforces foreign keys), so those two child tables are rebuilt first and the
-- old ones dropped before words. Renaming words_new to words rewrites the
-- foreign keys of progress_new / wrong_answers_new to point at words.

-- Target languages a course can teach.
CREATE TABLE IF NOT EXISTS languages (
  code           TEXT PRIMARY KEY,               -- e.g. en, ja
  name           TEXT NOT NULL,                  -- endonym for the course picker
  speech_locale  TEXT NOT NULL,                  -- speechSynthesis / SpeechRecognition locale
  spaced         INTEGER NOT NULL DEFAULT 1,     -- 1 when words are separated by spaces
  meaning_locale TEXT NOT NULL DEFAULT 'zh-Hant',-- locale of words.meaning for this course
  word_count     INTEGER NOT NULL DEFAULT 0      -- kept current by the import / reindex step
);
INSERT OR IGNORE INTO languages (code, name, speech_locale, spaced, meaning_locale) VALUES
  ('en', 'English', 'en-US', 1, 'zh-Hant'),
  ('ja', '日本語', 'ja-JP', 0, 'zh-Hant'),
  ('ko', '한국어', 'ko-KR', 1, 'zh-Hant'),
  ('es', 'Español', 'es-ES', 1, 'zh-Hant'),
  ('fr', 'Français', 'fr-FR', 1, 'zh-Hant'),
  ('de', 'Deutsch', 'de-DE', 1, 'zh-Hant');

CREATE TABLE words_new (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  lang       TEXT NOT NULL DEFAULT 'en',
  word       TEXT NOT NULL,
  pos        TEXT NOT NULL DEFAULT '',
  meaning    TEXT NOT NULL,                     -- gloss in languages.meaning_locale
  level      INTEGER,
  source     TEXT NOT NULL DEFAULT 'legacy',
  word_index INTEGER,                           -- 0-based position in the course path
  UNIQUE (lang, word)
);
INSERT INTO words_new (id, lang, word, pos, meaning, level, source)
  SELECT id, 'en', word, pos, meaning, level, source FROM words;

CREATE TABLE progress_new (
  user_id   INTEGER NOT NULL,
  word_id   INTEGER NOT NULL,
  seen      INTEGER NOT NULL DEFAULT 0,
  correct   INTEGER NOT NULL DEFAULT 0,
  streak    INTEGER NOT NULL DEFAULT 0,
  mastered  INTEGER NOT NULL DEFAULT 0,
  last_seen INTEGER,
  PRIMARY KEY (user_id, word_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (word_id) REFERENCES words_new(id) ON DELETE CASCADE
);
INSERT INTO progress_new (user_id, word_id, seen, correct, streak, mastered, last_seen)
  SELECT user_id, word_id, seen, correct, streak, mastered, last_seen FROM progress;

CREATE TABLE wrong_answers_new (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  word_id     INTEGER NOT NULL,
  mode        TEXT NOT NULL,
  your_answer TEXT NOT NULL DEFAULT '',
  created_at  INTEGER NOT NULL,
  resolved    INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (word_id) REFERENCES words_new(id) ON DELETE CASCADE
);
INSERT INTO wrong_answers_new (id, user_id, word_id, mode, your_answer, created_at, resolved)
  SELECT id, user_id, word_id, mode, your_answer, created_at, resolved FROM wrong_answers;

DROP TABLE wrong_answers;
DROP TABLE progress;
DROP TABLE words;
ALTER TABLE words_new RENAME TO words;
ALTER TABLE progress_new RENAME TO progress;
ALTER TABLE wrong_answers_new RENAME TO wrong_answers;

CREATE INDEX idx_words_lang_index ON words(lang, word_index);
CREATE INDEX idx_words_lang_level ON words(lang, level);
CREATE INDEX idx_progress_user ON progress(user_id, mastered, last_seen);
CREATE INDEX idx_wrong_user ON wrong_answers(user_id, resolved);

-- Same order the learning path used before (level, then id), now stored.
UPDATE words SET word_index = o.rn
  FROM (SELECT id, ROW_NUMBER() OVER (PARTITION BY lang ORDER BY COALESCE(level, 99), id) - 1 AS rn FROM words) AS o
 WHERE words.id = o.id;
UPDATE languages SET word_count = (SELECT COUNT(*) FROM words WHERE words.lang = languages.code);

-- Meanings in other learner locales. words.meaning is the fallback.
CREATE TABLE word_meanings (
  word_id INTEGER NOT NULL,
  locale  TEXT NOT NULL,
  meaning TEXT NOT NULL,
  PRIMARY KEY (word_id, locale),
  FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE
);

-- Learner preferences.
ALTER TABLE users ADD COLUMN locale TEXT NOT NULL DEFAULT 'zh-Hant';
ALTER TABLE users ADD COLUMN timezone TEXT NOT NULL DEFAULT 'Asia/Taipei';
ALTER TABLE users ADD COLUMN target_lang TEXT NOT NULL DEFAULT 'en';

-- Chapter keys become course-scoped: "1-1" -> "en:1-1".
UPDATE chapter_progress SET chapter = 'en:' || chapter WHERE chapter NOT LIKE '%:%';

-- Per-user, per-course counters so the leaderboard and stats never aggregate
-- the whole progress table.
CREATE TABLE user_stats (
  user_id  INTEGER NOT NULL,
  lang     TEXT NOT NULL,
  seen     INTEGER NOT NULL DEFAULT 0,
  answered INTEGER NOT NULL DEFAULT 0,
  correct  INTEGER NOT NULL DEFAULT 0,
  mastered INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, lang),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_user_stats_lang ON user_stats(lang);
INSERT INTO user_stats (user_id, lang, seen, answered, correct, mastered)
  SELECT p.user_id, w.lang, COUNT(*), SUM(p.seen), SUM(p.correct), SUM(p.mastered)
    FROM progress p JOIN words w ON w.id = p.word_id
   GROUP BY p.user_id, w.lang;

-- Server-issued quiz sessions. An answer only counts for an item the server
-- handed out, and only once.
CREATE TABLE quiz_sessions (
  id         TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL,
  lang       TEXT NOT NULL,
  locale     TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_quiz_sessions_user ON quiz_sessions(user_id, expires_at);

CREATE TABLE quiz_items (
  session_id  TEXT NOT NULL,
  position    INTEGER NOT NULL,
  word_id     INTEGER NOT NULL,
  mode        TEXT NOT NULL,
  expected    TEXT NOT NULL,
  answered_at INTEGER,
  correct     INTEGER,
  PRIMARY KEY (session_id, position),
  FOREIGN KEY (session_id) REFERENCES quiz_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE
);

-- Generated example sentences, reused across users.
CREATE TABLE ai_cards (
  word_id     INTEGER NOT NULL,
  locale      TEXT NOT NULL,
  sentence    TEXT NOT NULL,
  translation TEXT NOT NULL,
  synonyms    TEXT NOT NULL DEFAULT '[]',
  antonyms    TEXT NOT NULL DEFAULT '[]',
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (word_id, locale),
  FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE
);

-- Fixed-window request counters (see functions/_lib/rate-limit.ts).
CREATE TABLE rate_limits (
  key          TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count        INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (key, window_start)
);
CREATE INDEX idx_rate_limits_window ON rate_limits(window_start);

CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(user_id, expires_at);
