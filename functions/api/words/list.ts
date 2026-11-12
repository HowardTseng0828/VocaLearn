import type { Env } from "../../_lib/types";
import { json, error } from "../../_lib/http";
import { getUser } from "../../_lib/auth";
import { getLanguage, MEANING_COL, MEANING_JOIN } from "../../_lib/courses";

interface VocabularyWord { id: number; word: string; pos: string; meaning: string }
interface VocabularyPage { items: VocabularyWord[]; total: number }
interface ProgressRow { word_id: number; mastered: number; seen: number }

// GET /api/words/list?q=&page=1&size=50 — browse / search the current
// course's vocabulary, annotated with the user's mastery state. Meanings are
// shown in the user's locale when a translation exists.
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const user = await getUser(request, env);
  if (!user) return error("UNAUTHORIZED", 401);

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 50);
  const page = Math.min(Math.max(parseInt(url.searchParams.get("page") ?? "1", 10) || 1, 1), 1_000_000);
  const size = Math.min(
    Math.max(parseInt(url.searchParams.get("size") ?? "50", 10) || 50, 1),
    100
  );
  const offset = (page - 1) * size;

  const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const where = `WHERE w.lang = ?${q ? ` AND (w.word LIKE ? ESCAPE '\\' OR ${MEANING_COL} LIKE ? ESCAPE '\\')` : ""}`;
  const binds = q ? [user.target_lang, like, like] : [user.target_lang];

  const language = await getLanguage(env, user.target_lang);
  // Cache only shared vocabulary. Auth and personal progress are always fresh.
  // A word-count change immediately selects a new key; edits expire in 5 min.
  const cacheUrl = new URL("/_vocalearn-cache/words-v1", url.origin);
  cacheUrl.search = new URLSearchParams({
    lang: user.target_lang, locale: user.locale, q,
    page: String(page), size: String(size), count: String(language?.word_count ?? 0),
  }).toString();
  const cacheKey = new Request(cacheUrl);
  let vocabulary: VocabularyPage | undefined;
  try {
    const refresh = user.role === "admin" && url.searchParams.get("fresh") === "1";
    const cached = refresh ? undefined : await caches.default.match(cacheKey);
    if (cached) vocabulary = await cached.json<VocabularyPage>();
  } catch {
    // A cache miss or failure must not prevent database-backed browsing.
  }

  if (!vocabulary) {
    const { results } = await env.DB.prepare(
      `SELECT w.id, w.word, w.pos, ${MEANING_COL} AS meaning${q ? ", COUNT(*) OVER () AS total" : ""}
         FROM words w ${MEANING_JOIN} ${where}
         ORDER BY w.word ASC LIMIT ? OFFSET ?`
    ).bind(user.locale, ...binds, size, offset).all<VocabularyWord & { total?: number }>();
    let total = q ? results[0]?.total ?? 0 : language?.word_count ?? 0;
    // An out-of-range search page has no window row carrying its total.
    if (q && offset > 0 && results.length === 0) {
      const countRow = await env.DB.prepare(
        `SELECT COUNT(*) AS n FROM words w ${MEANING_JOIN} ${where}`
      ).bind(user.locale, ...binds).first<{ n: number }>();
      total = countRow?.n ?? 0;
    }
    vocabulary = {
      items: results.map(({ id, word, pos, meaning }) => ({ id, word, pos, meaning })),
      total,
    };
    context.waitUntil(caches.default.put(cacheKey, json(vocabulary, {
      headers: { "cache-control": "public, max-age=300" },
    })).catch(() => {}));
  }

  const ids = vocabulary.items.map((word) => word.id);
  const statements: D1PreparedStatement[] = [];
  // Leave one of D1's 100 parameters for user_id, including size=100 pages.
  for (let i = 0; i < ids.length; i += 99) {
    const batch = ids.slice(i, i + 99);
    statements.push(env.DB.prepare(
      `SELECT word_id, mastered, seen FROM progress
        WHERE user_id = ? AND word_id IN (${batch.map(() => "?").join(",")})`
    ).bind(user.id, ...batch));
  }
  const progress = statements.length ? await env.DB.batch<ProgressRow>(statements) : [];
  const byWord = new Map(progress.flatMap((result) => result.results).map((row) => [row.word_id, row]));

  return json({
    items: vocabulary.items.map((word) => ({
      ...word, mastered: byWord.get(word.id)?.mastered ?? 0, seen: byWord.get(word.id)?.seen ?? 0,
    })),
    total: vocabulary.total,
    page,
    size,
  }, { headers: { "cache-control": "private, no-store" } });
};
