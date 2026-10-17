import type { Env } from "../_lib/types";
import { json, error } from "../_lib/http";
import { getUser } from "../_lib/auth";
import { activityDay, addDays } from "../_lib/quiz";
import { getLanguage } from "../_lib/courses";

// GET /api/stats — learning progress for the current course, the streak, and
// a 90-day activity map. Counts come from user_stats, not from aggregating
// progress.
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const user = await getUser(request, env);
  if (!user) return error("UNAUTHORIZED", 401);

  const language = await getLanguage(env, user.target_lang);
  const stats = await env.DB.prepare(
    "SELECT seen, answered, correct, mastered FROM user_stats WHERE user_id = ? AND lang = ?"
  )
    .bind(user.id, user.target_lang)
    .first<{ seen: number; answered: number; correct: number; mastered: number }>();

  const openWrong = await env.DB.prepare(
    `SELECT COUNT(DISTINCT wa.word_id) AS n
       FROM wrong_answers wa JOIN words w ON w.id = wa.word_id
      WHERE wa.user_id = ? AND wa.resolved = 0 AND w.lang = ?`
  )
    .bind(user.id, user.target_lang)
    .first<{ n: number }>();

  // Last 90 days of activity for the heatmap.
  const { results: activity } = await env.DB.prepare(
    `SELECT day, answered, correct FROM daily_activity
      WHERE user_id = ? ORDER BY day DESC LIMIT 90`
  )
    .bind(user.id)
    .all<{ day: string; answered: number; correct: number }>();

  // Current consecutive-day streak in the user's time zone. Today may still be
  // empty without breaking the streak (count from yesterday).
  const days = new Set((activity ?? []).map((a) => a.day));
  const today = activityDay(Date.now(), user.timezone);
  let streak = 0;
  let cursor = today;
  for (let i = 0; i < 400; i++) {
    if (days.has(cursor)) {
      streak++;
    } else if (i > 0) {
      break;
    }
    cursor = addDays(cursor, -1);
  }

  const attempts = stats?.answered ?? 0;
  const correct = stats?.correct ?? 0;

  return json({
    totalWords: language?.word_count ?? 0,
    seen: stats?.seen ?? 0,
    mastered: stats?.mastered ?? 0,
    attempts,
    correct,
    accuracy: attempts > 0 ? Math.round((correct / attempts) * 100) : 0,
    openWrong: openWrong?.n ?? 0,
    streak,
    today,
    activity: (activity ?? []).reverse(),
  });
};
