import type { Env } from "../../_lib/types";
import { json, error } from "../../_lib/http";
import { getUser } from "../../_lib/auth";
import { MEANING_COL, MEANING_JOIN } from "../../_lib/courses";

// GET /api/words/list?q=&page=1&size=50 — browse / search the current
// course's vocabulary, annotated with the user's mastery state. Meanings are
// shown in the user's locale when a translation exists.
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const user = await getUser(request, env);
  if (!user) return error("UNAUTHORIZED", 401);

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 50);
  const page = Math.max(parseInt(url.searchParams.get("page") ?? "1", 10) || 1, 1);
  const size = Math.min(
    Math.max(parseInt(url.searchParams.get("size") ?? "50", 10) || 50, 1),
    100
  );
  const offset = (page - 1) * size;

  const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const where = `WHERE w.lang = ?${q ? ` AND (w.word LIKE ? ESCAPE '\\' OR ${MEANING_COL} LIKE ? ESCAPE '\\')` : ""}`;
  const binds = q ? [user.target_lang, like, like] : [user.target_lang];

  const countRow = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM words w ${MEANING_JOIN} ${where}`
  )
    .bind(user.locale, ...binds)
    .first<{ n: number }>();

  const { results } = await env.DB.prepare(
    `SELECT w.id, w.word, w.pos, ${MEANING_COL} AS meaning,
            COALESCE(p.mastered, 0) AS mastered,
            COALESCE(p.seen, 0) AS seen
       FROM words w
       ${MEANING_JOIN}
       LEFT JOIN progress p ON p.word_id = w.id AND p.user_id = ?
       ${where}
       ORDER BY w.word ASC
       LIMIT ? OFFSET ?`
  )
    .bind(user.locale, user.id, ...binds, size, offset)
    .all();

  return json({
    items: results ?? [],
    total: countRow?.n ?? 0,
    page,
    size,
  });
};
