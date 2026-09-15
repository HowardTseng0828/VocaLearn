-- Backfill chapter_progress.completed_at for chapters that counted as completed
-- under the old rule (every word in the chapter practised at least once).
--
-- The learning path now treats a chapter as completed only when completed_at is
-- set. Chapters finished before 0007 added that column never got it, so without
-- this backfill they would flip back to "not completed" and lock every chapter
-- after them. This is a one-time snapshot; it does not reintroduce the old rule.
WITH ordered AS (
  SELECT w.id,
         ROW_NUMBER() OVER (ORDER BY COALESCE(w.level, 99), w.id) - 1 AS word_index
    FROM words w
), totals AS (
  SELECT CAST(word_index / 20 AS INTEGER) AS lesson_index, COUNT(*) AS total
    FROM ordered
   GROUP BY lesson_index
), practiced AS (
  SELECT p.user_id, CAST(o.word_index / 20 AS INTEGER) AS lesson_index, COUNT(*) AS practiced
    FROM ordered o
    JOIN progress p ON p.word_id = o.id AND p.seen > 0
   GROUP BY p.user_id, lesson_index
)
INSERT INTO chapter_progress (user_id, chapter, question_index, updated_at, completed_at)
SELECT pr.user_id,
       ((pr.lesson_index / 10) + 1) || '-' || ((pr.lesson_index % 10) + 1),
       20,
       CAST(strftime('%s', 'now') AS INTEGER) * 1000,
       CAST(strftime('%s', 'now') AS INTEGER) * 1000
  FROM practiced pr
  JOIN totals t ON t.lesson_index = pr.lesson_index
 WHERE pr.practiced >= t.total
ON CONFLICT(user_id, chapter) DO UPDATE SET
  completed_at = COALESCE(chapter_progress.completed_at, excluded.completed_at);
