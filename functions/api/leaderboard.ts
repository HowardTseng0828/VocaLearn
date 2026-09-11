import type { Env } from "../_lib/types";
import { json } from "../_lib/http";
import { getUser } from "../_lib/auth";

interface LeaderboardRow {
  userId: number; displayName: string; answered: number; correct: number; mastered: number; score: number; rank: number;
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const user = await getUser(request, env);
  if (!user) return json({ error: "未登入" }, { status: 401 });
  const rows = await env.DB.prepare(`
    WITH activity AS (
      SELECT user_id, SUM(answered) answered, SUM(correct) correct FROM daily_activity GROUP BY user_id
    ), mastery AS (
      SELECT user_id, SUM(CASE WHEN mastered=1 THEN 1 ELSE 0 END) mastered FROM progress GROUP BY user_id
    ), ranked AS (
      SELECT u.id userId, u.display_name displayName,
        COALESCE(a.answered,0) answered, COALESCE(a.correct,0) correct, COALESCE(m.mastered,0) mastered,
        COALESCE(a.correct,0) + COALESCE(m.mastered,0) * 10 score
      FROM users u LEFT JOIN activity a ON a.user_id=u.id LEFT JOIN mastery m ON m.user_id=u.id
      WHERE u.leaderboard_visible=1 AND COALESCE(a.answered,0)>0
    )
    SELECT *, RANK() OVER (ORDER BY score DESC, correct DESC, answered ASC) rank
    FROM ranked ORDER BY rank LIMIT 100
  `).all<LeaderboardRow>();
  return json({ items: rows.results, currentUserId: user.id });
};
