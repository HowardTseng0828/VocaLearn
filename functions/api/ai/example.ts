import type { Env, Locale } from "../../_lib/types";
import { json, error, readJson } from "../../_lib/http";
import { getUser } from "../../_lib/auth";
import { generateCard, makeCloze, type AiCard } from "../../_lib/ai";
import { rateLimit, DAY } from "../../_lib/rate-limit";

interface Body {
  quizId?: string;
  position?: number;
}

interface ItemRow {
  word_id: number;
  word: string;
  pos: string;
  meaning: string;
  lang: string;
  locale: Locale;
  language_name: string;
  spaced: number;
}

interface CachedCard {
  sentence: string;
  translation: string;
  synonyms: string;
  antonyms: string;
}

// Gemini calls per user per day. Cached cards do not count.
const DAILY_AI_LIMIT = 60;

// POST /api/ai/example — example sentence + cloze for one quiz item.
// Cards are cached per (word, locale) and shared by every user, so each word
// costs at most one Gemini call per learner language. The response never
// includes the target word itself.
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const user = await getUser(request, env);
  if (!user) return error("UNAUTHORIZED", 401);

  const body = await readJson<Body>(request);
  const quizId = typeof body?.quizId === "string" ? body.quizId : "";
  const position = Number(body?.position);
  if (!quizId || !Number.isInteger(position) || position < 0) return error("BAD_REQUEST");

  const item = await env.DB.prepare(
    `SELECT w.id AS word_id, w.word, w.pos, COALESCE(wm.meaning, w.meaning) AS meaning,
            qs.lang, qs.locale, l.name AS language_name, l.spaced
       FROM quiz_items qi
       JOIN quiz_sessions qs ON qs.id = qi.session_id
       JOIN words w ON w.id = qi.word_id
       JOIN languages l ON l.code = qs.lang
       LEFT JOIN word_meanings wm ON wm.word_id = w.id AND wm.locale = qs.locale
      WHERE qi.session_id = ? AND qi.position = ? AND qs.user_id = ? AND qs.expires_at > ?`
  ).bind(quizId, position, user.id, Date.now()).first<ItemRow>();
  if (!item) return error("QUIZ_EXPIRED", 404);

  const cached = await env.DB.prepare(
    "SELECT sentence, translation, synonyms, antonyms FROM ai_cards WHERE word_id = ? AND locale = ?"
  ).bind(item.word_id, item.locale).first<CachedCard>();

  let card: AiCard;
  if (cached) {
    card = {
      sentence: cached.sentence,
      cloze: makeCloze(cached.sentence, item.word, item.lang),
      translation: cached.translation,
      source: "cache",
      synonyms: JSON.parse(cached.synonyms) as string[],
      antonyms: JSON.parse(cached.antonyms) as string[],
    };
  } else {
    // Over the limit, fall back to the built-in sample so the quiz continues.
    const allowed = await rateLimit(env, `ai:user:${user.id}`, DAILY_AI_LIMIT, DAY);
    card = await generateCard(allowed ? env : { ...env, GEMINI_API_KEY: undefined }, {
      word: item.word,
      pos: item.pos,
      meaning: item.meaning,
      languageName: item.language_name,
      langCode: item.lang,
      spaced: item.spaced === 1,
      locale: item.locale,
    });
    if (card.source === "ai") {
      await env.DB.prepare(
        `INSERT OR REPLACE INTO ai_cards (word_id, locale, sentence, translation, synonyms, antonyms, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        item.word_id, item.locale, card.sentence, card.translation,
        JSON.stringify(card.synonyms), JSON.stringify(card.antonyms), Date.now()
      ).run();
    }
  }

  return json({
    cloze: card.cloze,
    translation: card.translation,
    synonyms: card.synonyms,
    antonyms: card.antonyms,
    source: card.source,
  });
};
