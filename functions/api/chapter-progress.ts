import type { Env } from "../_lib/types";
import { error, json, readJson } from "../_lib/http";
import { getUser } from "../_lib/auth";
import { CHAPTER_PATTERN, chapterStorageKey, LESSON_SIZE } from "../_lib/courses";

// Chapters belong to the user's current course (users.target_lang).
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const user = await getUser(request, env);
  if (!user) return error("UNAUTHORIZED", 401);
  const chapter = new URL(request.url).searchParams.get("chapter") ?? "";
  if (!CHAPTER_PATTERN.test(chapter)) return error("INVALID_CHAPTER");
  const row = await env.DB.prepare(
    "SELECT question_index FROM chapter_progress WHERE user_id = ? AND chapter = ?"
  ).bind(user.id, chapterStorageKey(user.target_lang, chapter)).first<{ question_index: number }>();
  return json({ questionIndex: row?.question_index ?? 0 });
};

interface Body { chapter?: string; questionIndex?: number; completed?: boolean }

export const onRequestPut: PagesFunction<Env> = async ({ request, env }) => {
  const user = await getUser(request, env);
  if (!user) return error("UNAUTHORIZED", 401);
  const body = await readJson<Body>(request);
  const chapter = body?.chapter ?? "";
  if (!CHAPTER_PATTERN.test(chapter)) return error("INVALID_CHAPTER");
  const key = chapterStorageKey(user.target_lang, chapter);
  if (body?.completed) {
    await env.DB.prepare(
      `INSERT INTO chapter_progress (user_id, chapter, question_index, updated_at, completed_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id, chapter) DO UPDATE SET question_index = excluded.question_index, updated_at = excluded.updated_at, completed_at = excluded.completed_at`
    ).bind(user.id, key, LESSON_SIZE, Date.now(), Date.now()).run();
    return json({ ok: true });
  }
  const questionIndex = Math.max(0, Math.min(Number(body?.questionIndex) || 0, LESSON_SIZE - 1));
  // Keep completed_at untouched: replaying a finished chapter must not un-complete
  // it, which would re-lock every chapter after it.
  await env.DB.prepare(
    `INSERT INTO chapter_progress (user_id, chapter, question_index, updated_at, completed_at) VALUES (?, ?, ?, ?, NULL)
     ON CONFLICT(user_id, chapter) DO UPDATE SET question_index = excluded.question_index, updated_at = excluded.updated_at`
  ).bind(user.id, key, questionIndex, Date.now()).run();
  return json({ ok: true });
};
