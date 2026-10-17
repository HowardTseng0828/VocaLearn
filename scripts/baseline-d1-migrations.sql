-- One-time step for a database whose migrations 0001-0008 were applied by hand
-- with `wrangler d1 execute --file`. It records them in wrangler's d1_migrations
-- table, so `wrangler d1 migrations apply` only runs 0009 and later.
-- Do NOT run this on a new, empty database.
CREATE TABLE IF NOT EXISTS d1_migrations (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT UNIQUE,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);
INSERT OR IGNORE INTO d1_migrations (name) VALUES
  ('0001_init.sql'),
  ('0002_ceec_metadata.sql'),
  ('0003_auth_leaderboard.sql'),
  ('0004_user_roles.sql'),
  ('0005_fix_celsius.sql'),
  ('0006_chapter_progress.sql'),
  ('0007_chapter_completion.sql'),
  ('0008_backfill_chapter_completion.sql');
