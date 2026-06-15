import type { Env } from "../_lib/types";
import { json, error } from "../_lib/http";
import { getUser } from "../_lib/auth";

// GET /api/stats — learning progress summary, streak, and a 90-day activity map.
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const user = await getUser(request, env);
  if (!user) return error("未登入", 401);

  const totalWords = await env.DB.prepare("SELECT COUNT(*) AS n FROM words").first<{
    n: number;
  }>();

  const prog = await env.DB.prepare(
    `SELECT
        COUNT(*) AS seen,
        COALESCE(SUM(mastered), 0) AS mastered,
        COALESCE(SUM(seen), 0) AS attempts,
        COALESCE(SUM(correct), 0) AS correct
       FROM progress WHERE user_id = ?`
  )
    .bind(user.id)
    .first<{ seen: number; mastered: number; attempts: number; correct: number }>();

  const openWrong = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM wrong_answers WHERE user_id = ? AND resolved = 0"
  )
    .bind(user.id)
    .first<{ n: number }>();

  // Last 90 days of activity for the heatmap.
  const { results: activity } = await env.DB.prepare(
    `SELECT day, answered, correct FROM daily_activity
      WHERE user_id = ? ORDER BY day DESC LIMIT 90`
  )
    .bind(user.id)
    .all<{ day: string; answered: number; correct: number }>();

  // Compute the current consecutive-day streak (UTC) from activity days.
  const days = new Set((activity ?? []).map((a) => a.day));
  let streak = 0;
  const cursor = new Date();
  // Allow today to be empty without breaking the streak (count from yesterday).
  for (let i = 0; i < 400; i++) {
    const key = cursor.toISOString().slice(0, 10);
    if (days.has(key)) {
      streak++;
    } else if (i > 0) {
      break;
    }
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  const attempts = prog?.attempts ?? 0;
  const correct = prog?.correct ?? 0;

  return json({
    totalWords: totalWords?.n ?? 0,
    seen: prog?.seen ?? 0,
    mastered: prog?.mastered ?? 0,
    attempts,
    correct,
    accuracy: attempts > 0 ? Math.round((correct / attempts) * 100) : 0,
    openWrong: openWrong?.n ?? 0,
    streak,
    activity: (activity ?? []).reverse(),
  });
};
