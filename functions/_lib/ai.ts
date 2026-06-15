// Claude-backed example-sentence & cloze generation.
// Calls the Anthropic Messages API over raw fetch (the official SDK isn't a good
// fit for the Workers runtime). When ANTHROPIC_API_KEY is unset, returns a
// deterministic mock so the whole app works without a key.

import type { Env } from "./types";

export interface AiCard {
  sentence: string; // example sentence using the word
  cloze: string; // same sentence with the word blanked out as "_____"
  translation: string; // Traditional Chinese translation of the sentence
  source: "ai" | "mock";
}

const MODEL = "claude-opus-4-8";

// JSON schema constraining Claude's output for a reliable shape.
const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    sentence: { type: "string" },
    translation: { type: "string" },
  },
  required: ["sentence", "translation"],
  additionalProperties: false,
};

function makeCloze(sentence: string, word: string): string {
  // Replace the first whole-word, case-insensitive occurrence with a blank.
  const re = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
  if (re.test(sentence)) return sentence.replace(re, "_____");
  // Fallback: if the exact word isn't present (e.g. inflected), blank nothing.
  return sentence + " (_____)";
}

function mockCard(word: string, meaning: string): AiCard {
  const sentence = `The teacher asked the students to use the word "${word}" in a sentence.`;
  return {
    sentence,
    cloze: makeCloze(sentence, word),
    translation: `老師請學生用「${word}」（${meaning}）這個字造句。`,
    source: "mock",
  };
}

export async function generateCard(
  env: Env,
  word: string,
  pos: string,
  meaning: string
): Promise<AiCard> {
  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) return mockCard(word, meaning);

  const system =
    "You are an English vocabulary tutor for Taiwanese senior-high-school students. " +
    "Given an English word, write ONE natural example sentence (8-16 words) that clearly " +
    "demonstrates its meaning, suitable for a high-school learner. Then give a Traditional " +
    "Chinese translation of that sentence. The example sentence MUST contain the exact target " +
    "word. Respond only via the structured output schema.";

  const userPrompt =
    `Target word: ${word}\n` +
    (pos ? `Part of speech: ${pos}\n` : "") +
    `Chinese meaning: ${meaning}\n` +
    "Write the example sentence and its Traditional Chinese translation.";

  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        thinking: { type: "adaptive" },
        system,
        messages: [{ role: "user", content: userPrompt }],
        output_config: {
          format: { type: "json_schema", schema: OUTPUT_SCHEMA },
        },
      }),
    });

    if (!resp.ok) return mockCard(word, meaning);
    const data = (await resp.json()) as {
      content?: { type: string; text?: string }[];
      stop_reason?: string;
    };
    if (data.stop_reason === "refusal") return mockCard(word, meaning);

    const textBlock = (data.content ?? []).find((b) => b.type === "text");
    if (!textBlock?.text) return mockCard(word, meaning);

    const parsed = JSON.parse(textBlock.text) as {
      sentence: string;
      translation: string;
    };
    const sentence = parsed.sentence?.trim() || mockCard(word, meaning).sentence;
    return {
      sentence,
      cloze: makeCloze(sentence, word),
      translation: parsed.translation?.trim() ?? "",
      source: "ai",
    };
  } catch {
    return mockCard(word, meaning);
  }
}
