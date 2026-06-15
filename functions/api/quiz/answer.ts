import type { Env, QuizMode } from "../../_lib/types";
import { json, error, readJson } from "../../_lib/http";
import { getUser } from "../../_lib/auth";
import { recordAnswer } from "../../_lib/quiz";

interface Body {
  wordId?: number;
  mode?: QuizMode;
  answer?: string; // the user's submitted answer (choice text or typed text)
}

const VALID_MODES: QuizMode[] = ["en2zh", "zh2en", "spell", "cloze"];

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

// POST /api/quiz/answer — server-side validation + progress recording.
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const user = await getUser(request, env);
  if (!user) return error("未登入", 401);

  const body = await readJson<Body>(request);
  const wordId = body?.wordId;
  const mode = body?.mode;
  const answer = body?.answer ?? "";

  if (!wordId || !mode || !VALID_MODES.includes(mode)) {
    return error("無效的作答資料");
  }

  const word = await env.DB.prepare(
    "SELECT id, word, pos, meaning FROM words WHERE id = ?"
  )
    .bind(wordId)
    .first<{ id: number; word: string; pos: string; meaning: string }>();
  if (!word) return error("找不到單字", 404);

  // The correct answer depends on the mode.
  // en2zh -> pick the meaning; zh2en/spell/cloze -> type the English word.
  const expected = mode === "en2zh" ? word.meaning : word.word;
  const isCorrect = norm(answer) === norm(expected);

  const { mastered } = await recordAnswer(
    env,
    user.id,
    word.id,
    mode,
    isCorrect,
    answer
  );

  return json({
    correct: isCorrect,
    expected,
    word: word.word,
    meaning: word.meaning,
    mastered,
  });
};
