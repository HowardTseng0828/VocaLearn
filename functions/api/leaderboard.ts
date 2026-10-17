import type { Env } from "../_lib/types";
import { json, error } from "../_lib/http";
import { getUser } from "../_lib/auth";

interface LeaderboardRow {
  userId: number; displayName: string; answered: number; correct: number; mastered: number; score: number; rank: number;
}

// GET /api/leaderboard — top 100 of the user's current course. Reads the
// per-user counters in user_stats (one row per learner), never progress.
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const user = await getUser(request, env);
  if (!user) return error("UNAUTHORIZED", 401);
  const rows = await env.DB.prepare(`
    WITH ranked AS (
      SELECT u.id userId, u.display_name displayName,
             s.answered, s.correct, s.mastered,
             s.correct + s.mastered * 10 score
        FROM user_stats s JOIN users u ON u.id = s.user_id
       WHERE s.lang = ? AND u.leaderboard_visible = 1 AND s.answered > 0
    )
    SELECT *, RANK() OVER (ORDER BY score DESC, correct DESC, answered ASC) rank
      FROM ranked ORDER BY rank LIMIT 100
  `).bind(user.target_lang).all<LeaderboardRow>();
  return json({
    items: rows.results,
    currentUserId: user.id,
    visible: user.leaderboard_visible === 1,
  });
};
