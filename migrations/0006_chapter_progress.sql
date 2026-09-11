CREATE TABLE IF NOT EXISTS chapter_progress (
  user_id INTEGER NOT NULL,
  chapter TEXT NOT NULL,
  question_index INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, chapter),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
