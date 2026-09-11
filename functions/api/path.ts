import type { Env } from "../_lib/types";
import { error, json } from "../_lib/http";
import { getUser } from "../_lib/auth";

const LESSON_SIZE = 20;
const LESSONS_PER_UNIT = 10;

export interface PathLessonRow {
  lessonIndex: number;
  total: number;
  mastered: number;
  practiced: number;
}

// GET /api/path — the user's Duolingo-style learning path.
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const user = await getUser(request, env);
  if (!user) return error("未登入", 401);

  const { results } = await env.DB.prepare(
    `WITH ordered AS (
       SELECT w.id,
              ROW_NUMBER() OVER (ORDER BY COALESCE(w.level, 99), w.id) - 1 AS word_index
         FROM words w
     ), lessons AS (
       SELECT CAST(o.word_index / ? AS INTEGER) AS lessonIndex,
              COUNT(*) AS total,
              SUM(CASE WHEN COALESCE(p.mastered, 0) = 1 THEN 1 ELSE 0 END) AS mastered,
              SUM(CASE WHEN COALESCE(p.seen, 0) > 0 THEN 1 ELSE 0 END) AS practiced
         FROM ordered o
         LEFT JOIN progress p ON p.word_id = o.id AND p.user_id = ?
        GROUP BY lessonIndex
     )
     SELECT lessonIndex, total, mastered, practiced FROM lessons ORDER BY lessonIndex`
  )
    .bind(LESSON_SIZE, user.id)
    .all<PathLessonRow>();

  const rows = results ?? [];
  const completedRows = await env.DB.prepare(
    "SELECT chapter FROM chapter_progress WHERE user_id = ? AND completed_at IS NOT NULL"
  ).bind(user.id).all<{ chapter: string }>();
  const completedChapters = new Set((completedRows.results ?? []).map((row) => row.chapter));
  const lessons = rows.map((row, index) => {
    const key = `${Math.floor(row.lessonIndex / LESSONS_PER_UNIT) + 1}-${(row.lessonIndex % LESSONS_PER_UNIT) + 1}`;
    const completed = completedChapters.has(key) || (row.total > 0 && row.practiced >= row.total);
    const previous = rows[index - 1];
    const previousKey = previous ? `${Math.floor(previous.lessonIndex / LESSONS_PER_UNIT) + 1}-${(previous.lessonIndex % LESSONS_PER_UNIT) + 1}` : "";
    const previousCompleted = !previous || completedChapters.has(previousKey) || (previous.total > 0 && previous.practiced >= previous.total);
    return {
      key,
      unit: Math.floor(row.lessonIndex / LESSONS_PER_UNIT) + 1,
      lesson: (row.lessonIndex % LESSONS_PER_UNIT) + 1,
      total: row.total,
      mastered: row.mastered,
      practiced: row.practiced,
      completed,
      unlocked: index === 0 || previousCompleted,
    };
  });

  return json({ lessons, lessonSize: LESSON_SIZE, lessonsPerUnit: LESSONS_PER_UNIT });
};
