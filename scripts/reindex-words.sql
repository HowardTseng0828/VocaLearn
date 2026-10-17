-- Recomputes each course's learning-path order and word counts.
-- Run after seeding or bulk-loading words outside the in-app CSV import.
UPDATE words SET word_index = o.rn
  FROM (SELECT id, ROW_NUMBER() OVER (PARTITION BY lang ORDER BY COALESCE(level, 99), id) - 1 AS rn FROM words) AS o
 WHERE words.id = o.id AND words.word_index IS NOT o.rn;
UPDATE languages SET word_count = (SELECT COUNT(*) FROM words WHERE words.lang = languages.code);
