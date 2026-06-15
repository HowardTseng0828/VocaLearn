import type { Env } from "../../_lib/types";
import { json, error, readJson } from "../../_lib/http";
import { getUser } from "../../_lib/auth";
import { generateCard } from "../../_lib/ai";

interface Body {
  wordId?: number;
}

// POST /api/ai/example — generate an AI example sentence + cloze for a word.
// Falls back to a mock when ANTHROPIC_API_KEY is unset.
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const user = await getUser(request, env);
  if (!user) return error("未登入", 401);

  const body = await readJson<Body>(request);
  if (!body?.wordId) return error("缺少 wordId");

  const word = await env.DB.prepare(
    "SELECT word, pos, meaning FROM words WHERE id = ?"
  )
    .bind(body.wordId)
    .first<{ word: string; pos: string; meaning: string }>();
  if (!word) return error("找不到單字", 404);

  const card = await generateCard(env, word.word, word.pos, word.meaning);
  return json({ ...card, word: word.word, meaning: word.meaning });
};
