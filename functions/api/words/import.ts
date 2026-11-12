import type { Env } from "../../_lib/types";
import { json, error, readJson } from "../../_lib/http";
import { getUser } from "../../_lib/auth";
import { parseCsv, splitPosMeaning } from "../../_lib/csv";
import { getLanguage, reindexLanguage } from "../../_lib/courses";
import { normalizeLocale } from "../../_lib/i18n";

interface Body {
  csv?: string;
  lang?: string; // target-language course to import into (default: admin's current course)
  locale?: string; // set to import meanings for an extra learner locale instead of words
}

interface ParsedWord {
  word: string;
  pos: string;
  meaning: string;
  level: number | null;
  source: string;
}

// POST /api/words/import — bulk-import vocabulary from CSV text (admin only).
//
// Words: a 2-column file (word,"<pos><meaning>") or 3+ columns
// (word,pos,meaning[,level[,source]]). The meaning is in the course's
// languages.meaning_locale. level drives the learning-path order.
//
// Translations: with `locale` set to another learner locale, each row is
// word,meaning (or word,pos,meaning) and fills word_meanings for words that
// already exist in the course.
//
// A header row is auto-detected and skipped.
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const user = await getUser(request, env);
  if (!user) return error("UNAUTHORIZED", 401);
  if (user.role !== "admin") return error("ADMIN_ONLY", 403);

  const body = await readJson<Body>(request);
  const csv = body?.csv;
  if (!csv || csv.trim().length === 0) return error("CSV_EMPTY");

  const language = await getLanguage(env, body?.lang || user.target_lang);
  if (!language) return error("UNSUPPORTED_LANGUAGE");
  const meaningLocale = body?.locale ? normalizeLocale(body.locale) : null;
  if (body?.locale && !meaningLocale) return error("BAD_REQUEST");
  const translationsOnly = meaningLocale !== null && meaningLocale !== language.meaning_locale;

  const rows = parseCsv(csv);
  const parsed: ParsedWord[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 2) continue;
    const word = (row[0] ?? "").trim().normalize("NFC");
    if (!word) continue;

    // Skip an obvious header row.
    if (i === 0 && /^word$/i.test(word)) continue;

    let pos = "";
    let meaning = "";
    if (row.length >= 3) {
      pos = (row[1] ?? "").trim();
      meaning = (row[2] ?? "").trim();
    } else if (translationsOnly) {
      meaning = (row[1] ?? "").trim();
    } else {
      const split = splitPosMeaning((row[1] ?? "").trim());
      pos = split.pos;
      meaning = split.meaning;
    }
    if (!meaning) continue;
    const levelRaw = parseInt((row[3] ?? "").trim(), 10);
    const level = Number.isFinite(levelRaw) ? levelRaw : null;
    const source = (row[4] ?? "").trim() || "import";
    parsed.push({ word, pos, meaning, level, source });
  }

  if (parsed.length === 0) return error("CSV_NO_ROWS");

  // Insert in batches (D1 supports batched statements). Existing words are left
  // untouched ((lang, word) is UNIQUE); translations are upserted.
  const batchSize = 100;
  let imported = 0;
  for (let i = 0; i < parsed.length; i += batchSize) {
    const chunk = parsed.slice(i, i + batchSize);
    const statements = chunk.map((w) =>
      translationsOnly
        ? env.DB.prepare(
            `INSERT INTO word_meanings (word_id, locale, meaning)
             SELECT id, ?, ? FROM words WHERE lang = ? AND word = ?
             ON CONFLICT(word_id, locale) DO UPDATE SET meaning = excluded.meaning
             WHERE word_meanings.meaning IS NOT excluded.meaning`
          ).bind(meaningLocale, w.meaning, language.code, w.word)
        : env.DB.prepare(
            "INSERT OR IGNORE INTO words (lang, word, pos, meaning, level, source) VALUES (?, ?, ?, ?, ?, ?)"
          ).bind(language.code, w.word, w.pos, w.meaning, w.level, w.source)
    );
    const results = await env.DB.batch(statements);
    imported += results.reduce(
      (sum, r) => sum + ((r.meta?.changes as number) ?? 0),
      0
    );
  }

  if (!translationsOnly && imported > 0) await reindexLanguage(env, language.code);
  const total = await getLanguage(env, language.code);

  return json({
    parsed: parsed.length,
    imported,
    skipped: parsed.length - imported,
    total: total?.word_count ?? 0,
  });
};
