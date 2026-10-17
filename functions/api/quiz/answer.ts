import type { Env, QuizMode } from "../../_lib/types";
import { json, error, readJson } from "../../_lib/http";
import { getUser } from "../../_lib/auth";
import { normalizeAnswer, recordAnswer } from "../../_lib/quiz";

interface Body {
  quizId?: string;
  position?: number;
  answer?: string; // the user's submitted answer (choice text or typed text)
}

interface ItemRow {
  word_id: number;
  mode: QuizMode;
  expected: string;
  answered_at: number | null;
  lang: string;
  word: string;
  meaning: string;
}

// POST /api/quiz/answer — grades one item of a server-issued quiz session.
// Only the first answer to an item is recorded; later answers (the "try
// again" button) are graded without touching progress, so a client cannot
// replay answers or invent items to farm leaderboard points.
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const user = await getUser(request, env);
  if (!user) return error("UNAUTHORIZED", 401);

  const body = await readJson<Body>(request);
  const quizId = typeof body?.quizId === "string" ? body.quizId : "";
  const position = Number(body?.position);
  const answer = String(body?.answer ?? "");
  if (!quizId || !Number.isInteger(position) || position < 0) return error("BAD_REQUEST");

  const now = Date.now();
  const item = await env.DB.prepare(
    `SELECT qi.word_id, qi.mode, qi.expected, qi.answered_at, qs.lang, w.word,
            COALESCE(wm.meaning, w.meaning) AS meaning
       FROM quiz_items qi
       JOIN quiz_sessions qs ON qs.id = qi.session_id
       JOIN words w ON w.id = qi.word_id
       LEFT JOIN word_meanings wm ON wm.word_id = w.id AND wm.locale = qs.locale
      WHERE qi.session_id = ? AND qi.position = ? AND qs.user_id = ? AND qs.expires_at > ?`
  ).bind(quizId, position, user.id, now).first<ItemRow>();
  if (!item) return error("QUIZ_EXPIRED", 404);

  const isCorrect = normalizeAnswer(answer) === normalizeAnswer(item.expected);

  let recorded = false;
  let mastered = false;
  if (item.answered_at === null) {
    // The answered_at guard makes concurrent duplicate submissions record once.
    const claim = await env.DB.prepare(
      `UPDATE quiz_items SET answered_at = ?, correct = ?
        WHERE session_id = ? AND position = ? AND answered_at IS NULL`
    ).bind(now, isCorrect ? 1 : 0, quizId, position).run();
    recorded = claim.meta.changes === 1;
  }
  if (recorded) {
    ({ mastered } = await recordAnswer(env, user, item.word_id, item.lang, item.mode, isCorrect, answer));
  } else {
    const prog = await env.DB.prepare(
      "SELECT mastered FROM progress WHERE user_id = ? AND word_id = ?"
    ).bind(user.id, item.word_id).first<{ mastered: number }>();
    mastered = prog?.mastered === 1;
  }

  return json({
    correct: isCorrect,
    expected: item.expected,
    word: item.word,
    meaning: item.meaning,
    mastered,
    recorded,
  });
};
