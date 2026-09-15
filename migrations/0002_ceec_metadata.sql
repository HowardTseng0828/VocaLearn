-- CEEC metadata columns (level, source) on the words table.
--
-- These columns are now part of 0001_init.sql, so this file is only needed for
-- a database created before 0001 included them. SQLite has no
-- "ALTER TABLE ... ADD COLUMN IF NOT EXISTS", so running the two ALTERs on a
-- current database fails with "duplicate column name: level" and aborts the
-- migration. They are kept here, commented out, as a record of the change:
-- uncomment them only when upgrading such a legacy database.
--
--   ALTER TABLE words ADD COLUMN level INTEGER;
--   ALTER TABLE words ADD COLUMN source TEXT NOT NULL DEFAULT 'legacy';

CREATE INDEX IF NOT EXISTS idx_words_level ON words(level);
