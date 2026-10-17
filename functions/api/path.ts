import type { Env } from "../_lib/types";
import { error, json } from "../_lib/http";
import { getUser } from "../_lib/auth";
import { chapterKeyOf, getLanguage, LESSON_SIZE, LESSONS_PER_UNIT } from "../_lib/courses";

// GET /api/path — the user's Duolingo-style learning path for their course.
// Chapter sizes come from languages.word_count and the user's own progress
// rows, so this never scans the whole word list.
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const user = await getUser(request, env);
  if (!user) return error("UNAUTHORIZED", 401);

  const language = await getLanguage(env, user.target_lang);
  const wordCount = language?.word_count ?? 0;
  const lang = user.target_lang;

  const { results } = await env.DB.prepare(
    `SELECT CAST(w.word_index / ? AS INTEGER) AS lessonIndex,
            SUM(p.mastered) AS mastered,
            COUNT(*) AS practiced
       FROM progress p JOIN words w ON w.id = p.word_id
      WHERE p.user_id = ? AND w.lang = ? AND p.seen > 0
      GROUP BY lessonIndex`
  )
    .bind(LESSON_SIZE, user.id, lang)
    .all<{ lessonIndex: number; mastered: number; practiced: number }>();
  const progressByLesson = new Map((results ?? []).map((row) => [row.lessonIndex, row]));

  const completedRows = await env.DB.prepare(
    "SELECT chapter FROM chapter_progress WHERE user_id = ? AND chapter LIKE ? AND completed_at IS NOT NULL"
  ).bind(user.id, `${lang}:%`).all<{ chapter: string }>();
  const completedChapters = new Set(
    (completedRows.results ?? []).map((row) => row.chapter.slice(lang.length + 1))
  );

  // A chapter counts as completed only when it was finished inside the chapter
  // quiz (chapter_progress.completed_at). Practising the same words elsewhere
  // (daily challenge, random practice, notebook review) must not complete or
  // unlock a chapter the user never opened.
  const lessonCount = Math.ceil(wordCount / LESSON_SIZE);
  const lessons = Array.from({ length: lessonCount }, (_, lessonIndex) => {
    const key = chapterKeyOf(lessonIndex);
    const completed = completedChapters.has(key);
    const previousCompleted = lessonIndex === 0 || completedChapters.has(chapterKeyOf(lessonIndex - 1));
    const progress = progressByLesson.get(lessonIndex);
    return {
      key,
      unit: Math.floor(lessonIndex / LESSONS_PER_UNIT) + 1,
      lesson: (lessonIndex % LESSONS_PER_UNIT) + 1,
      total: Math.min(LESSON_SIZE, wordCount - lessonIndex * LESSON_SIZE),
      mastered: progress?.mastered ?? 0,
      practiced: progress?.practiced ?? 0,
      completed,
      // A chapter already finished stays playable even if an earlier chapter is
      // not marked completed, so it can always be replayed.
      unlocked: previousCompleted || completed,
    };
  });

  return json({ lessons, lessonSize: LESSON_SIZE, lessonsPerUnit: LESSONS_PER_UNIT });
};
