// Quiz helpers shared across routes: grading, progress recording, day keys.

import type { Env, QuizMode } from "./types";

const MASTER_STREAK = 3; // streak at which a word is considered "mastered"

export interface WordRow {
  id: number;
  word: string;
  pos: string;
  meaning: string;
}

// Activity days are calendar days in the learner's own time zone. With a fixed
// offset, anything studied around local midnight lands on the wrong day, which
// breaks both the streak and the heatmap.
export function activityDay(ts: number, timeZone: string): string {
  try {
    // en-CA formats as YYYY-MM-DD.
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(ts);
  } catch {
    return new Date(ts).toISOString().slice(0, 10);
  }
}

// Shifts a YYYY-MM-DD key by whole days.
export function addDays(day: string, delta: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

// Normalizes an answer for comparison: Unicode width (NFKC), case, curly
// quotes, whitespace, and trailing Latin or CJK punctuation.
export function normalizeAnswer(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[.,!?。、！？]/g, "")
    .replace(/\s+/g, " ");
}

// Records one graded answer: updates progress, the per-course counters, daily
// activity, and the wrong-answer notebook in a single batch. Returns the
// resulting mastered flag.
export async function recordAnswer(
  env: Env,
  user: { id: number; timezone: string },
  wordId: number,
  lang: string,
  mode: QuizMode,
  isCorrect: boolean,
  yourAnswer: string
): Promise<{ mastered: boolean }> {
  const now = Date.now();
  const day = activityDay(now, user.timezone);

  const prog = await env.DB.prepare(
    "SELECT seen, correct, streak, mastered FROM progress WHERE user_id = ? AND word_id = ?"
  )
    .bind(user.id, wordId)
    .first<{ seen: number; correct: number; streak: number; mastered: number }>();

  const seen = (prog?.seen ?? 0) + 1;
  const correct = (prog?.correct ?? 0) + (isCorrect ? 1 : 0);
  const streak = isCorrect ? (prog?.streak ?? 0) + 1 : 0;
  const mastered = streak >= MASTER_STREAK ? 1 : 0;
  const masteredDelta = mastered - (prog?.mastered ?? 0);
  const correctInc = isCorrect ? 1 : 0;

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
    ).bind(user.id, wordId, seen, correct, streak, mastered, now),
    env.DB.prepare(
      `INSERT INTO user_stats (user_id, lang, seen, answered, correct, mastered)
       VALUES (?, ?, ?, 1, ?, ?)
       ON CONFLICT(user_id, lang) DO UPDATE SET
         seen = seen + excluded.seen,
         answered = answered + 1,
         correct = correct + excluded.correct,
         mastered = MAX(mastered + excluded.mastered, 0)`
    ).bind(user.id, lang, prog ? 0 : 1, correctInc, masteredDelta),
    env.DB.prepare(
      `INSERT INTO daily_activity (user_id, day, answered, correct)
       VALUES (?, ?, 1, ?)
       ON CONFLICT(user_id, day) DO UPDATE SET
         answered = answered + 1,
         correct = correct + excluded.correct`
    ).bind(user.id, day, correctInc),
  ];

  if (isCorrect) {
    // A correct answer resolves any open wrong-answer entries for this word.
    statements.push(
      env.DB.prepare(
        "UPDATE wrong_answers SET resolved = 1 WHERE user_id = ? AND word_id = ? AND resolved = 0"
      ).bind(user.id, wordId)
    );
  } else {
    statements.push(
      env.DB.prepare(
        `INSERT INTO wrong_answers (user_id, word_id, mode, your_answer, created_at, resolved)
         VALUES (?, ?, ?, ?, ?, 0)`
      ).bind(user.id, wordId, mode, yourAnswer.slice(0, 200), now)
    );
  }

  await env.DB.batch(statements);
  return { mastered: mastered === 1 };
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Distinct random integers in [0, max), at most `count` of them.
export function randomIndexes(max: number, count: number): number[] {
  const picked = new Set<number>();
  const target = Math.min(count, max);
  while (picked.size < target) picked.add(Math.floor(Math.random() * max));
  return [...picked];
}

// Hint data for typed answers: the first letters plus a mask of the length,
// so the client never receives the full answer before it is graded.
export function hintFor(word: string): { hint: string; mask: string } {
  const chars = Array.from(word);
  return {
    hint: chars.slice(0, Math.min(3, chars.length)).join(""),
    mask: chars.map((char) => (char === " " ? " " : "_")).join(""),
  };
}
