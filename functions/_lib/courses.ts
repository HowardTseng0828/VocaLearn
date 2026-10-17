// Target-language courses (the languages table) and locale-aware meanings.

import type { Env } from "./types";

export interface LanguageRow {
  code: string;
  name: string;
  speech_locale: string;
  spaced: number;
  meaning_locale: string;
  word_count: number;
}

export async function listLanguages(env: Env): Promise<LanguageRow[]> {
  const { results } = await env.DB.prepare(
    "SELECT code, name, speech_locale, spaced, meaning_locale, word_count FROM languages ORDER BY code"
  ).all<LanguageRow>();
  return results ?? [];
}

export async function getLanguage(env: Env, code: string): Promise<LanguageRow | null> {
  return env.DB.prepare(
    "SELECT code, name, speech_locale, spaced, meaning_locale, word_count FROM languages WHERE code = ?"
  ).bind(code).first<LanguageRow>();
}

export function publicLanguage(row: LanguageRow) {
  return {
    code: row.code,
    name: row.name,
    speechLocale: row.speech_locale,
    spaced: row.spaced === 1,
    wordCount: row.word_count,
  };
}

// SQL pieces for a meaning in the learner's locale, falling back to the
// course's own gloss (words.meaning). Use with an alias `w` for words and bind
// the locale where MEANING_JOIN appears.
export const MEANING_JOIN = "LEFT JOIN word_meanings wm ON wm.word_id = w.id AND wm.locale = ?";
export const MEANING_COL = "COALESCE(wm.meaning, w.meaning)";

// Learning-path layout: chapters ("unit-lesson", e.g. "1-3") of LESSON_SIZE
// words in words.word_index order, LESSONS_PER_UNIT chapters per unit.
export const LESSON_SIZE = 20;
export const LESSONS_PER_UNIT = 10;
export const CHAPTER_PATTERN = /^(\d+)-(\d+)$/;

export function lessonIndexOf(chapter: string): number {
  const match = CHAPTER_PATTERN.exec(chapter);
  if (!match) return -1;
  return (Math.max(Number(match[1]), 1) - 1) * LESSONS_PER_UNIT + Math.max(Number(match[2]), 1) - 1;
}

export function chapterKeyOf(lessonIndex: number): string {
  return `${Math.floor(lessonIndex / LESSONS_PER_UNIT) + 1}-${(lessonIndex % LESSONS_PER_UNIT) + 1}`;
}

// chapter_progress rows are scoped by course: "en:1-3".
export function chapterStorageKey(lang: string, chapter: string): string {
  return `${lang}:${chapter}`;
}

// Recomputes the learning-path order and word count of one course.
export async function reindexLanguage(env: Env, lang: string): Promise<void> {
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE words SET word_index = o.rn
         FROM (SELECT id, ROW_NUMBER() OVER (ORDER BY COALESCE(level, 99), id) - 1 AS rn
                 FROM words WHERE lang = ?) AS o
        WHERE words.id = o.id AND words.word_index IS NOT o.rn`
    ).bind(lang),
    env.DB.prepare(
      "UPDATE languages SET word_count = (SELECT COUNT(*) FROM words WHERE lang = ?) WHERE code = ?"
    ).bind(lang, lang),
  ]);
}
