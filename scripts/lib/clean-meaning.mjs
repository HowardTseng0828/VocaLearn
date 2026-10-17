// Normalizes a dictionary meaning into a short gloss that works as a quiz choice.
//
// Meanings that came from the ECDICT fallback look like
//   "n. 酸, 酸類物質, 尖刻；a. 酸的；[計] 自動文檔互參與索引生成程式"
// and some carry a literal "\r" from the original Big5 export. Long, tagged
// glosses make the correct answer the obvious "longest choice", so they are cut
// down to the first few plain senses. Short, already-clean meanings pass through.

const MAX_SENSES = 3;
const POS_PREFIX = /^(?:(?:[a-z]+\.)\s*)+/i;
const DOMAIN_TAG = /^\[[^\]]+\]/;

export function isDirtyMeaning(meaning) {
  return /\\r|\r|\[[^\]]+\]/.test(meaning) || /(^|[；;]\s*)[a-z]+\.\s/i.test(meaning) || meaning.length > 30;
}

// Entries whose only gloss is a domain-tagged (mostly mainland computing) term.
const OVERRIDES = new Map([
  ["doc", "醫生；文件"],
  ["download", "下載"],
  ["hacker", "駭客"],
  ["online", "線上的；網路上的"],
  ["upload", "上傳"],
]);

export function cleanMeaning(meaning, word = "") {
  const override = OVERRIDES.get(word.toLowerCase());
  if (override) return override;
  const raw = String(meaning ?? "").replace(/\\r|\r/g, "").trim();
  if (!isDirtyMeaning(raw)) return raw;
  const senses = [];
  for (const segment of raw.split(/[；;]/)) {
    const text = segment.trim();
    if (!text || DOMAIN_TAG.test(text.replace(POS_PREFIX, "").trim())) continue;
    for (const item of text.replace(POS_PREFIX, "").split(/[,，]/)) {
      const sense = item.trim();
      if (sense && !DOMAIN_TAG.test(sense) && !senses.includes(sense)) senses.push(sense);
    }
  }
  return senses.length ? senses.slice(0, MAX_SENSES).join("；") : raw;
}
