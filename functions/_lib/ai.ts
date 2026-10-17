// Gemini-backed example-sentence & cloze generation.
// Calls the Google Gemini REST API over raw fetch.
// When GEMINI_API_KEY is unset, returns a deterministic mock
// so the whole app works without a key.

import type { Env, Locale } from "./types";
import { LOCALE_PROMPT_NAME } from "./i18n";

export interface AiCard {
  sentence: string; // example sentence using the word
  cloze: string; // same sentence with the word blanked out as "_____"
  translation: string; // translation of the sentence into the learner's locale
  source: "ai" | "mock" | "cache";
  synonyms: string[];
  antonyms: string[];
}

export interface CardRequest {
  word: string;
  pos: string;
  meaning: string;
  languageName: string; // target language, e.g. "English"
  langCode: string;
  spaced: boolean; // false for languages written without spaces (ja, zh, th)
  locale: Locale; // learner's language for the translation
}

const DEFAULT_MODEL = "gemini-3.1-flash-lite";

// JSON schema constraining Gemini's output for a reliable shape.
const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    sentence: { type: "string" },
    translation: { type: "string" },
    synonyms: { type: "array", items: { type: "string" } },
    antonyms: { type: "array", items: { type: "string" } },
  },
  required: ["sentence", "translation"],
};

// Escapes a string for literal use inside a RegExp.
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Matches the target word. For English it is a whole-word match that allows
// the common inflections (-s, -es, -ed, -ing, -d). \b only applies where the
// entry starts or ends with an ASCII word character: entries such as "a.m."
// end in punctuation, and kana/kanji never match \w at all.
export function targetWordPattern(word: string, langCode: string): RegExp {
  const head = /^\w/.test(word) ? "\\b" : "";
  const inflection = langCode === "en" ? "(?:s|es|ed|ing|d)?" : "";
  const tail = /\w$/.test(word) ? `${inflection}\\b` : "";
  return new RegExp(`${head}${escapeRegExp(word)}${tail}`, "i");
}

export function makeCloze(sentence: string, word: string, langCode: string): string {
  // Replace the first case-insensitive occurrence with a blank.
  const re = targetWordPattern(word, langCode);
  if (re.test(sentence)) return sentence.replace(re, "_____");
  // Fallback: if the word is not present at all, blank nothing.
  return sentence + " (_____)";
}

// The translation is sent before the answer, so it must not contain the word.
const MOCK_TRANSLATION: Record<Locale, (meaning: string) => string> = {
  "zh-Hant": (meaning) => `老師請學生用這個字（${meaning}）造句。`,
  en: (meaning) => `The teacher asked the students to use this word (${meaning}) in a sentence.`,
  ja: (meaning) => `先生は生徒にこの単語（${meaning}）を使って文を作るように言いました。`,
};

function mockCard(req: CardRequest): AiCard {
  const sentence = `The teacher asked the students to use the word "${req.word}" in a sentence.`;
  return {
    sentence,
    cloze: makeCloze(sentence, req.word, req.langCode),
    translation: MOCK_TRANSLATION[req.locale](req.meaning),
    source: "mock",
    synonyms: [],
    antonyms: [],
  };
}

// Length check that works for languages with and without spaces.
function plausibleLength(sentence: string, spaced: boolean): boolean {
  if (spaced) {
    const words = sentence.split(/\s+/).filter(Boolean).length;
    // Keep some slack around the 8-16 word instruction. Rejecting a sentence
    // that is a couple of words over falls back to the mock card, which makes
    // every AI example look identical.
    return words >= 6 && words <= 22;
  }
  const chars = Array.from(sentence.replace(/\s/g, "")).length;
  return chars >= 8 && chars <= 80;
}

export async function generateCard(env: Env, req: CardRequest): Promise<AiCard> {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) return mockCard(req);
  const model = env.GEMINI_MODEL ?? DEFAULT_MODEL;
  const learnerLanguage = LOCALE_PROMPT_NAME[req.locale];

  const system =
    `You are a ${req.languageName} vocabulary tutor for secondary-school learners whose first language is ${learnerLanguage}. ` +
    `Write exactly one natural, beginner-friendly example sentence in ${req.languageName} ` +
    (req.spaced ? "of 8-16 words. " : "of 10-40 characters. ") +
    "Use the target word exactly as supplied, in exactly that written form, with the supplied part of speech and sense. " +
    "Do not use names, politics, violence, mature content, obscure idioms, or facts that require verification. " +
    `Translate the full sentence into natural ${learnerLanguage}. Also provide up to three common ${req.languageName} synonyms and antonyms for the target word. Never explain your answer.`;

  const userPrompt =
    `Target word: ${req.word}\n` +
    (req.pos ? `Part of speech: ${req.pos}\n` : "") +
    `Meaning: ${req.meaning}\n` +
    "Write the example sentence, its translation, synonyms, and antonyms.";

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: system }]
        },
        contents: [
          { role: "user", parts: [{ text: userPrompt }] }
        ],
        generationConfig: {
          temperature: 0.2,
          thinkingConfig: { thinkingLevel: "low" },
          responseMimeType: "application/json",
          responseJsonSchema: OUTPUT_SCHEMA,
        },
      }),
    });

    if (!resp.ok) {
      console.error("Gemini API Error:", await resp.text());
      return mockCard(req);
    }

    const data = (await resp.json()) as {
      candidates?: {
        content?: {
          parts?: { text?: string }[];
        };
      }[];
    };

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return mockCard(req);

    const parsed = JSON.parse(text) as {
      sentence: string;
      translation: string;
      synonyms?: string[];
      antonyms?: string[];
    };
    const sentence = parsed.sentence?.trim();
    const translation = parsed.translation?.trim();
    if (!sentence || !translation || !targetWordPattern(req.word, req.langCode).test(sentence) || !plausibleLength(sentence, req.spaced)) {
      console.error("Gemini response failed vocabulary-card validation");
      return mockCard(req);
    }
    return {
      sentence,
      cloze: makeCloze(sentence, req.word, req.langCode),
      translation,
      source: "ai",
      synonyms: Array.isArray(parsed.synonyms) ? parsed.synonyms.slice(0, 3) : [],
      antonyms: Array.isArray(parsed.antonyms) ? parsed.antonyms.slice(0, 3) : [],
    };
  } catch (err) {
    console.error("Failed to parse Gemini response:", err);
    return mockCard(req);
  }
}
