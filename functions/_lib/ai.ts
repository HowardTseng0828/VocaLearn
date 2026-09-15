// Gemini-backed example-sentence & cloze generation.
// Calls the Google Gemini REST API over raw fetch.
// When GEMINI_API_KEY is unset, returns a deterministic mock
// so the whole app works without a key.

import type { Env } from "./types";

export interface AiCard {
  sentence: string; // example sentence using the word
  cloze: string; // same sentence with the word blanked out as "_____"
  translation: string; // Traditional Chinese translation of the sentence
  source: "ai" | "mock";
  synonyms: string[];
  antonyms: string[];
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

// Matches the target word as a whole word, allowing the common English
// inflections (-s, -es, -ed, -ing, -d) so a natural sentence is not rejected.
// \b only applies where the entry actually starts or ends with a word
// character: entries such as "a.m." end in punctuation, where a trailing \b
// would never match.
function targetWordPattern(word: string): RegExp {
  const head = /^\w/.test(word) ? "\\b" : "";
  const tail = /\w$/.test(word) ? "(?:s|es|ed|ing|d)?\\b" : "";
  return new RegExp(`${head}${escapeRegExp(word)}${tail}`, "i");
}

function makeCloze(sentence: string, word: string): string {
  // Replace the first whole-word, case-insensitive occurrence with a blank.
  const re = targetWordPattern(word);
  if (re.test(sentence)) return sentence.replace(re, "_____");
  // Fallback: if the word is not present at all, blank nothing.
  return sentence + " (_____)";
}

function mockCard(word: string, meaning: string): AiCard {
  const sentence = `The teacher asked the students to use the word "${word}" in a sentence.`;
  return {
    sentence,
    cloze: makeCloze(sentence, word),
    translation: `老師請學生用「${word}」（${meaning}）這個字造句。`,
    source: "mock",
    synonyms: [],
    antonyms: [],
  };
}

export async function generateCard(
  env: Env,
  word: string,
  pos: string,
  meaning: string
): Promise<AiCard> {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) return mockCard(word, meaning);
  const model = env.GEMINI_MODEL ?? DEFAULT_MODEL;

  const system =
    "You are an English vocabulary tutor for Taiwanese senior-high-school students. " +
    "Write exactly one natural example sentence of 8-16 English words for a Taiwanese senior-high-school learner. " +
    "Use the target word exactly as supplied, with the supplied part of speech and Chinese sense. " +
    "Do not use names, politics, violence, mature content, obscure idioms, or facts that require verification. " +
    "Translate the full sentence into natural Traditional Chinese. Also provide up to three common English synonyms and antonyms for the target word. Never explain your answer.";

  const userPrompt =
    `Target word: ${word}\n` +
    (pos ? `Part of speech: ${pos}\n` : "") +
    `Chinese meaning: ${meaning}\n` +
    "Write the example sentence, Traditional Chinese translation, synonyms, and antonyms.";

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
      return mockCard(word, meaning);
    }

    const data = (await resp.json()) as {
      candidates?: {
        content?: {
          parts?: { text?: string }[];
        };
      }[];
    };

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return mockCard(word, meaning);

    const parsed = JSON.parse(text) as {
      sentence: string;
      translation: string;
      synonyms?: string[];
      antonyms?: string[];
    };
    const sentence = parsed.sentence?.trim();
    const translation = parsed.translation?.trim();
    const targetPattern = targetWordPattern(word);
    const wordCount = sentence?.split(/\s+/).filter(Boolean).length ?? 0;
    // Keep some slack around the 8-16 word instruction. Rejecting a sentence
    // that is a couple of words over falls back to the mock card, which makes
    // every AI example look identical.
    if (!sentence || !translation || !targetPattern.test(sentence) || wordCount < 6 || wordCount > 22) {
      console.error("Gemini response failed vocabulary-card validation");
      return mockCard(word, meaning);
    }
    return {
      sentence,
      cloze: makeCloze(sentence, word),
      translation,
      source: "ai",
      synonyms: Array.isArray(parsed.synonyms) ? parsed.synonyms.slice(0, 3) : [],
      antonyms: Array.isArray(parsed.antonyms) ? parsed.antonyms.slice(0, 3) : [],
    };
  } catch (err) {
    console.error("Failed to parse Gemini response:", err);
    return mockCard(word, meaning);
  }
}
