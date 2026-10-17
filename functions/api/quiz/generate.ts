import type { Env, QuizMode, UserRow } from "../../_lib/types";
import { json, error } from "../../_lib/http";
import { getUser, randomToken } from "../../_lib/auth";
import { hintFor, randomIndexes, shuffle, type WordRow } from "../../_lib/quiz";
import { rateLimit, HOUR } from "../../_lib/rate-limit";
import { getLanguage, lessonIndexOf, LESSON_SIZE, MEANING_COL, MEANING_JOIN } from "../../_lib/courses";

// What the client receives. The answer itself is never included for typed
// modes (spell, cloze); the server keeps it in quiz_items.expected.
interface Question {
  position: number;
  mode: QuizMode;
  pos: string;
  word?: string; // en2zh, speech
  meaning?: string; // zh2en, spell, cloze, speech
  choices?: string[]; // en2zh, zh2en
  hint?: string; // spell, cloze: first letters, revealed one by one
  mask?: string; // spell, cloze: "_" per character, spaces kept
}

const MODES: QuizMode[] = ["en2zh", "zh2en", "spell", "cloze", "speech"];
const SESSION_TTL_MS = 6 * HOUR;
// D1 allows at most 100 bound parameters per statement.
const MAX_PROBES = 80;

type ReviewRow = WordRow & { review_mode?: QuizMode };

// GET /api/quiz/generate?mode=random|en2zh|zh2en|spell|cloze|speech&count=10
//   &review=1        — draw from the wrong-answer notebook
//   &reviewCorrect=1 — draw from words answered correctly before
//   &chapter=1-3     — one learning-path chapter, in path order
// Creates a quiz session; answers are only accepted for its items.
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const user = await getUser(request, env);
  if (!user) return error("UNAUTHORIZED", 401);
  if (!(await rateLimit(env, `quiz:user:${user.id}`, 120, HOUR))) return error("RATE_LIMITED", 429);

  const language = await getLanguage(env, user.target_lang);
  if (!language || language.word_count === 0) return json({ quizId: "", questions: [] });
  const lang = language.code;
  const locale = user.locale;

  const url = new URL(request.url);
  const modeParam = (url.searchParams.get("mode") ?? "random") as QuizMode | "random";
  if (modeParam !== "random" && !MODES.includes(modeParam)) return error("BAD_REQUEST");
  const count = Math.min(
    Math.max(parseInt(url.searchParams.get("count") ?? "10", 10) || 10, 1),
    30
  );
  const reviewOnly = url.searchParams.get("review") === "1";
  const reviewCorrect = url.searchParams.get("reviewCorrect") === "1";
  const chapterIndex = lessonIndexOf(url.searchParams.get("chapter") ?? "");

  let words: ReviewRow[];
  if (reviewCorrect) {
    const { results } = await env.DB.prepare(
      `SELECT w.id, w.word, w.pos, ${MEANING_COL} AS meaning
         FROM progress p JOIN words w ON w.id = p.word_id
         ${MEANING_JOIN}
        WHERE p.user_id = ? AND w.lang = ? AND (p.correct > 0 OR p.mastered = 1)
        ORDER BY RANDOM() LIMIT ?`
    ).bind(locale, user.id, lang, count).all<WordRow>();
    words = results ?? [];
  } else if (reviewOnly) {
    // One row per word: keep the mode of the most recent miss.
    const { results } = await env.DB.prepare(
      `SELECT w.id, w.word, w.pos, ${MEANING_COL} AS meaning,
              (SELECT wa2.mode FROM wrong_answers wa2
                WHERE wa2.user_id = wa.user_id AND wa2.word_id = wa.word_id AND wa2.resolved = 0
                ORDER BY wa2.created_at DESC LIMIT 1) AS review_mode
         FROM wrong_answers wa JOIN words w ON w.id = wa.word_id
         ${MEANING_JOIN}
        WHERE wa.user_id = ? AND wa.resolved = 0 AND w.lang = ?
        GROUP BY w.id
        ORDER BY RANDOM() LIMIT ?`
    ).bind(locale, user.id, lang, count).all<ReviewRow>();
    words = results ?? [];
  } else if (chapterIndex >= 0) {
    // Chapter order must be stable: chapter_progress.question_index is an index
    // into this list, so a random order would skip words when resuming.
    const offset = chapterIndex * LESSON_SIZE;
    const { results } = await env.DB.prepare(
      `SELECT w.id, w.word, w.pos, ${MEANING_COL} AS meaning
         FROM words w
         ${MEANING_JOIN}
        WHERE w.lang = ? AND w.word_index >= ? AND w.word_index < ?
        ORDER BY w.word_index
        LIMIT ?`
    ).bind(locale, lang, offset, offset + LESSON_SIZE, count).all<WordRow>();
    words = results ?? [];
  } else {
    words = await practiceWords(env, user, lang, language.word_count, count);
  }
  if (words.length === 0) return json({ quizId: "", questions: [] });

  const modes = words.map((w) =>
    modeParam !== "random"
      ? modeParam
      : reviewOnly && w.review_mode && MODES.includes(w.review_mode)
        ? w.review_mode
        : MODES[Math.floor(Math.random() * MODES.length)]
  );

  // One query for every multiple-choice distractor, probing random path
  // positions instead of ORDER BY RANDOM() over the whole course.
  const choiceCount = modes.filter((m) => m === "en2zh" || m === "zh2en").length;
  let pool: WordRow[] = [];
  if (choiceCount > 0) {
    const probes = randomIndexes(language.word_count, Math.min(choiceCount * 4 + 8, MAX_PROBES));
    const { results } = await env.DB.prepare(
      `SELECT w.id, w.word, w.pos, ${MEANING_COL} AS meaning
         FROM words w
         ${MEANING_JOIN}
        WHERE w.lang = ? AND w.word_index IN (${probes.map(() => "?").join(",")})`
    ).bind(locale, lang, ...probes).all<WordRow>();
    pool = shuffle(results ?? []);
  }

  const quizId = randomToken(16);
  const now = Date.now();
  const questions: Question[] = [];
  const expected: string[] = [];
  words.forEach((w, position) => {
    const mode = modes[position];
    const q: Question = { position, mode, pos: w.pos };
    if (mode === "en2zh") {
      q.word = w.word;
      q.choices = withDistractors(w.meaning, pool.filter((p) => p.id !== w.id).map((p) => p.meaning));
    } else if (mode === "zh2en") {
      q.meaning = w.meaning;
      q.choices = withDistractors(w.word, pool.filter((p) => p.id !== w.id).map((p) => p.word));
    } else if (mode === "spell" || mode === "cloze") {
      q.meaning = w.meaning;
      Object.assign(q, hintFor(w.word));
    } else {
      q.word = w.word;
      q.meaning = w.meaning;
    }
    questions.push(q);
    expected.push(mode === "en2zh" ? w.meaning : w.word);
  });

  await env.DB.batch([
    env.DB.prepare("DELETE FROM quiz_sessions WHERE user_id = ? AND expires_at < ?").bind(user.id, now),
    env.DB.prepare(
      "INSERT INTO quiz_sessions (id, user_id, lang, locale, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(quizId, user.id, lang, locale, now, now + SESSION_TTL_MS),
    ...words.map((w, position) =>
      env.DB.prepare(
        "INSERT INTO quiz_items (session_id, position, word_id, mode, expected) VALUES (?, ?, ?, ?, ?)"
      ).bind(quizId, position, w.id, modes[position], expected[position])
    ),
  ]);

  return json({ quizId, questions });
};

// The correct option plus up to three distinct distractors, shuffled.
function withDistractors(correct: string, candidates: string[]): string[] {
  const seen = new Set([correct.trim().toLowerCase()]);
  const picked: string[] = [];
  for (const candidate of shuffle(candidates)) {
    const key = candidate.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push(candidate);
    if (picked.length === 3) break;
  }
  return shuffle([correct, ...picked]);
}

// Default practice set: up to half unmastered words due for review (oldest
// first), the rest new words drawn from random positions in the course,
// preferring words the user has not seen yet.
async function practiceWords(env: Env, user: UserRow, lang: string, wordCount: number, count: number): Promise<WordRow[]> {
  const { results: due } = await env.DB.prepare(
    `SELECT w.id, w.word, w.pos, ${MEANING_COL} AS meaning
       FROM progress p JOIN words w ON w.id = p.word_id
       ${MEANING_JOIN}
      WHERE p.user_id = ? AND p.mastered = 0 AND w.lang = ?
      ORDER BY p.last_seen ASC LIMIT ?`
  ).bind(user.locale, user.id, lang, Math.floor(count / 2)).all<WordRow>();
  const chosen = due ?? [];
  const taken = new Set(chosen.map((w) => w.id));

  const probes = randomIndexes(wordCount, Math.min((count - chosen.length) * 3 + 5, MAX_PROBES));
  const { results: fresh } = await env.DB.prepare(
    `SELECT w.id, w.word, w.pos, ${MEANING_COL} AS meaning, COALESCE(p.seen, 0) AS seen, COALESCE(p.mastered, 0) AS mastered
       FROM words w
       ${MEANING_JOIN}
       LEFT JOIN progress p ON p.word_id = w.id AND p.user_id = ?
      WHERE w.lang = ? AND w.word_index IN (${probes.map(() => "?").join(",")})`
  ).bind(user.locale, user.id, lang, ...probes).all<WordRow & { seen: number; mastered: number }>();

  const ranked = (fresh ?? [])
    .filter((w) => !taken.has(w.id))
    .sort((a, b) => a.mastered - b.mastered || a.seen - b.seen);
  for (const w of ranked) {
    if (chosen.length >= count) break;
    chosen.push({ id: w.id, word: w.word, pos: w.pos, meaning: w.meaning });
  }
  return shuffle(chosen);
}
