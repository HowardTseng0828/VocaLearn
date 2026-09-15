// Quiz helpers shared across routes: distractor generation, progress recording.

import type { Env, QuizMode } from "./types";

const MASTER_STREAK = 3; // streak at which a word is considered "mastered"

export interface WordRow {
  id: number;
  word: string;
  pos: string;
  meaning: string;
}

// Activity days use Asia/Taipei (UTC+8, no DST), not UTC. With UTC, anything
// studied between 00:00 and 08:00 local time counts as the previous day, which
// breaks both the streak and the heatmap for users in Taiwan.
export const DAY_OFFSET_MS = 8 * 60 * 60 * 1000;

export function activityDay(ts: number): string {
  return new Date(ts + DAY_OFFSET_MS).toISOString().slice(0, 10);
}

// Records one quiz answer: updates progress, daily activity, and the wrong-answer
// notebook in a single batch. Returns the resulting mastered flag.
export async function recordAnswer(
  env: Env,
  userId: number,
  wordId: number,
  mode: QuizMode,
  isCorrect: boolean,
  yourAnswer: string
): Promise<{ mastered: boolean }> {
  const now = Date.now();
  const day = activityDay(now);

  // Read current progress to compute the new streak/mastered values.
  const prog = await env.DB.prepare(
    "SELECT seen, correct, streak FROM progress WHERE user_id = ? AND word_id = ?"
  )
    .bind(userId, wordId)
    .first<{ seen: number; correct: number; streak: number }>();

  const seen = (prog?.seen ?? 0) + 1;
  const correct = (prog?.correct ?? 0) + (isCorrect ? 1 : 0);
  const streak = isCorrect ? (prog?.streak ?? 0) + 1 : 0;
  const mastered = streak >= MASTER_STREAK ? 1 : 0;

  const statements = [
    env.DB.prepare(
      `INSERT INTO progress (user_id, word_id, seen, correct, streak, mastered, last_seen)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, word_id) DO UPDATE SET
         seen = excluded.seen,
         correct = excluded.correct,
         streak = excluded.streak,
         mastered = excluded.mastered,
         last_seen = excluded.last_seen`
    ).bind(userId, wordId, seen, correct, streak, mastered, now),
    env.DB.prepare(
      `INSERT INTO daily_activity (user_id, day, answered, correct)
       VALUES (?, ?, 1, ?)
       ON CONFLICT(user_id, day) DO UPDATE SET
         answered = answered + 1,
         correct = correct + ?`
    ).bind(userId, day, isCorrect ? 1 : 0, isCorrect ? 1 : 0),
  ];

  if (isCorrect) {
    // A correct answer resolves any open wrong-answer entries for this word.
    statements.push(
      env.DB.prepare(
        "UPDATE wrong_answers SET resolved = 1 WHERE user_id = ? AND word_id = ? AND resolved = 0"
      ).bind(userId, wordId)
    );
  } else {
    statements.push(
      env.DB.prepare(
        `INSERT INTO wrong_answers (user_id, word_id, mode, your_answer, created_at, resolved)
         VALUES (?, ?, ?, ?, ?, 0)`
      ).bind(userId, wordId, mode, yourAnswer.slice(0, 200), now)
    );
  }

  await env.DB.batch(statements);
  return { mastered: mastered === 1 };
}

// Picks `count` random meanings distinct from the given word, for multiple choice.
// Meanings are de-duplicated and the correct meaning is excluded, so a choice
// list never contains two identical options.
export async function distractorMeanings(
  env: Env,
  excludeWordId: number,
  excludeMeaning: string,
  count: number
): Promise<string[]> {
  const { results } = await env.DB.prepare(
    "SELECT DISTINCT meaning FROM words WHERE id != ? AND meaning != ? ORDER BY RANDOM() LIMIT ?"
  )
    .bind(excludeWordId, excludeMeaning, count)
    .all<{ meaning: string }>();
  return (results ?? []).map((r) => r.meaning);
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
