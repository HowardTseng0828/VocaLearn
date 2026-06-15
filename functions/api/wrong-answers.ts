import type { Env } from "../_lib/types";
import { json, error, readJson } from "../_lib/http";
import { getUser } from "../_lib/auth";

// GET /api/wrong-answers — the wrong-answer notebook (open items, newest first).
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const user = await getUser(request, env);
  if (!user) return error("未登入", 401);

  const url = new URL(request.url);
  const includeResolved = url.searchParams.get("all") === "1";

  const { results } = await env.DB.prepare(
    `SELECT wa.id, wa.mode, wa.your_answer, wa.created_at, wa.resolved,
            w.id AS word_id, w.word, w.pos, w.meaning
       FROM wrong_answers wa JOIN words w ON w.id = wa.word_id
      WHERE wa.user_id = ? ${includeResolved ? "" : "AND wa.resolved = 0"}
      ORDER BY wa.created_at DESC LIMIT 300`
  )
    .bind(user.id)
    .all();

  return json({ items: results ?? [] });
};

interface DeleteBody {
  id?: number;
}

// POST /api/wrong-answers with {id} removes one notebook entry.
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const user = await getUser(request, env);
  if (!user) return error("未登入", 401);

  const body = await readJson<DeleteBody>(request);
  if (!body?.id) return error("缺少 id");

  await env.DB.prepare(
    "DELETE FROM wrong_answers WHERE id = ? AND user_id = ?"
  )
    .bind(body.id, user.id)
    .run();

  return json({ ok: true });
};
