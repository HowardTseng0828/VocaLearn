import type { Env } from "../../_lib/types";
import { json, error } from "../../_lib/http";
import { getUser } from "../../_lib/auth";

// GET /api/words/list?q=&page=1&size=50 — browse / search the vocabulary,
// annotated with the current user's mastery state.
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const user = await getUser(request, env);
  if (!user) return error("未登入", 401);

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const page = Math.max(parseInt(url.searchParams.get("page") ?? "1", 10) || 1, 1);
  const size = Math.min(
    Math.max(parseInt(url.searchParams.get("size") ?? "50", 10) || 50, 1),
    100
  );
  const offset = (page - 1) * size;

  const like = `%${q}%`;
  const where = q ? "WHERE w.word LIKE ? OR w.meaning LIKE ?" : "";
  const binds = q ? [like, like] : [];

  const countRow = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM words w ${where}`
  )
    .bind(...binds)
    .first<{ n: number }>();

  const { results } = await env.DB.prepare(
    `SELECT w.id, w.word, w.pos, w.meaning,
            COALESCE(p.mastered, 0) AS mastered,
            COALESCE(p.seen, 0) AS seen
       FROM words w
       LEFT JOIN progress p ON p.word_id = w.id AND p.user_id = ?
       ${where}
       ORDER BY w.word ASC
       LIMIT ? OFFSET ?`
  )
    .bind(user.id, ...binds, size, offset)
    .all();

  return json({
    items: results ?? [],
    total: countRow?.n ?? 0,
    page,
    size,
  });
};
