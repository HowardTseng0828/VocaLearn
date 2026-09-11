import type { Env } from "../_lib/types";
import { error, json, readJson } from "../_lib/http";
import { getUser } from "../_lib/auth";

const CHAPTER_PATTERN = /^\d+-\d+$/;

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const user = await getUser(request, env);
  if (!user) return error("未登入", 401);
  const chapter = new URL(request.url).searchParams.get("chapter") ?? "";
  if (!CHAPTER_PATTERN.test(chapter)) return error("無效章節");
  const row = await env.DB.prepare(
    "SELECT question_index FROM chapter_progress WHERE user_id = ? AND chapter = ?"
  ).bind(user.id, chapter).first<{ question_index: number }>();
  return json({ questionIndex: row?.question_index ?? 0 });
};

interface Body { chapter?: string; questionIndex?: number; completed?: boolean }

export const onRequestPut: PagesFunction<Env> = async ({ request, env }) => {
  const user = await getUser(request, env);
  if (!user) return error("未登入", 401);
  const body = await readJson<Body>(request);
  const chapter = body?.chapter ?? "";
  if (!CHAPTER_PATTERN.test(chapter)) return error("無效章節");
  if (body?.completed) {
    await env.DB.prepare(
      `INSERT INTO chapter_progress (user_id, chapter, question_index, updated_at, completed_at) VALUES (?, ?, 20, ?, ?)
       ON CONFLICT(user_id, chapter) DO UPDATE SET question_index = 20, updated_at = excluded.updated_at, completed_at = excluded.completed_at`
    ).bind(user.id, chapter, Date.now(), Date.now()).run();
    return json({ ok: true });
  }
  const questionIndex = Math.max(0, Math.min(Number(body?.questionIndex) || 0, 19));
  await env.DB.prepare(
    `INSERT INTO chapter_progress (user_id, chapter, question_index, updated_at, completed_at) VALUES (?, ?, ?, ?, NULL)
     ON CONFLICT(user_id, chapter) DO UPDATE SET question_index = excluded.question_index, updated_at = excluded.updated_at, completed_at = NULL`
  ).bind(user.id, chapter, questionIndex, Date.now()).run();
  return json({ ok: true });
};
