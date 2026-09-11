import type { Env, QuizMode } from "../../_lib/types";
import { json, error } from "../../_lib/http";
import { getUser } from "../../_lib/auth";
import { distractorMeanings, shuffle, type WordRow } from "../../_lib/quiz";

interface Question {
  wordId: number;
  word: string;
  pos: string;
  meaning: string;
  mode: QuizMode;
  // For multiple-choice modes (en2zh / zh2en):
  choices?: string[];
}

const MODES: QuizMode[] = ["en2zh", "zh2en", "spell", "cloze", "speech"];

// GET /api/quiz/generate?mode=random|en2zh|zh2en|spell|cloze&count=10&review=1
// review=1 draws words from the wrong-answer notebook first.
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const user = await getUser(request, env);
  if (!user) return error("未登入", 401);

  const url = new URL(request.url);
  const modeParam = (url.searchParams.get("mode") ?? "random") as
    | QuizMode
    | "random";
  const count = Math.min(
    Math.max(parseInt(url.searchParams.get("count") ?? "10", 10) || 10, 1),
    30
  );
  const reviewOnly = url.searchParams.get("review") === "1";
  const reviewCorrect = url.searchParams.get("reviewCorrect") === "1";
  const chapter = url.searchParams.get("chapter") ?? "";
  const chapterMatch = /^(\d+)-(\d+)$/.exec(chapter);
  const chapterIndex = chapterMatch
    ? (Math.max(Number(chapterMatch[1]), 1) - 1) * 10 + Math.max(Number(chapterMatch[2]), 1) - 1
    : -1;

  // Select candidate words. In review mode, draw unresolved wrong answers;
  // otherwise prioritize unmastered/unseen words, then fall back to random.
  let words: WordRow[];
  if (reviewCorrect) {
    const { results } = await env.DB.prepare(
      `SELECT w.id, w.word, w.pos, w.meaning FROM words w JOIN progress p ON p.word_id = w.id
        WHERE p.user_id = ? AND (p.correct > 0 OR p.mastered = 1) ORDER BY RANDOM() LIMIT ?`
    ).bind(user.id, count).all<WordRow>();
    words = results ?? [];
    if (words.length === 0) return json({ questions: [] });
  } else if (reviewOnly) {
    const { results } = await env.DB.prepare(
      `SELECT DISTINCT w.id, w.word, w.pos, w.meaning, wa.mode AS review_mode
         FROM wrong_answers wa JOIN words w ON w.id = wa.word_id
        WHERE wa.user_id = ? AND wa.resolved = 0
        ORDER BY RANDOM() LIMIT ?`
    )
      .bind(user.id, count)
      .all<WordRow>();
    words = results ?? [];
    if (words.length === 0) return json({ questions: [] });
  } else if (chapterIndex >= 0) {
    const offset = chapterIndex * 20;
    const { results } = await env.DB.prepare(
      `WITH ordered AS (
         SELECT w.id, w.word, w.pos, w.meaning,
                ROW_NUMBER() OVER (ORDER BY COALESCE(w.level, 99), w.id) - 1 AS word_index
           FROM words w
       )
       SELECT o.id, o.word, o.pos, o.meaning
         FROM ordered o
         LEFT JOIN progress p ON p.word_id = o.id AND p.user_id = ?
        WHERE o.word_index >= ? AND o.word_index < ?
        ORDER BY COALESCE(p.mastered, 0) ASC, COALESCE(p.seen, 0) ASC, RANDOM()
        LIMIT ?`
    )
      .bind(user.id, offset, offset + 20, count)
      .all<WordRow>();
    words = results ?? [];
  } else {
    const { results } = await env.DB.prepare(
      `SELECT w.id, w.word, w.pos, w.meaning
         FROM words w
         LEFT JOIN progress p ON p.word_id = w.id AND p.user_id = ?
        ORDER BY COALESCE(p.mastered, 0) ASC, COALESCE(p.seen, 0) ASC, RANDOM()
        LIMIT ?`
    )
      .bind(user.id, count)
      .all<WordRow>();
    words = results ?? [];
  }

  const questions: Question[] = [];
  for (const w of words) {
    const mode: QuizMode =
      modeParam === "random"
        ? (reviewOnly && (w as WordRow & { review_mode?: QuizMode }).review_mode
            ? (w as WordRow & { review_mode: QuizMode }).review_mode
            : MODES[Math.floor(Math.random() * MODES.length)])
        : modeParam;

    const q: Question = {
      wordId: w.id,
      word: w.word,
      pos: w.pos,
      meaning: w.meaning,
      mode,
    };

    if (mode === "en2zh") {
      const distractors = await distractorMeanings(env, w.id, 3);
      q.choices = shuffle([w.meaning, ...distractors]);
    } else if (mode === "zh2en") {
      const { results } = await env.DB.prepare(
        "SELECT word FROM words WHERE id != ? ORDER BY RANDOM() LIMIT 3"
      )
        .bind(w.id)
        .all<{ word: string }>();
      const distractors = (results ?? []).map((r) => r.word);
      q.choices = shuffle([w.word, ...distractors]);
    }
    // spell & cloze are free-text — no choices.
    questions.push(q);
  }

  return json({ questions });
};
