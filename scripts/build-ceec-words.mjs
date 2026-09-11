import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const CEEC_JSON = "https://raw.githubusercontent.com/EngTW/English-for-Programmers/main/lists/Taiwan-high-school-6K-108-edition/Data/Taiwan-high-school-english-reference-vocabulary-list-108-edition.json";
const MODEL = "gemini-3.1-flash-lite";
const ECDICT_CSV = "https://raw.githubusercontent.com/skywind3000/ECDICT/master/ecdict.csv";

function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted && ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
    else if (ch === '"') quoted = !quoted;
    else if (ch === "," && !quoted) { row.push(field); field = ""; }
    else if ((ch === "\n" || ch === "\r") && !quoted) {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); if (row.some(Boolean)) rows.push(row); row = []; field = "";
    } else field += ch;
  }
  row.push(field); if (row.some(Boolean)) rows.push(row);
  return rows;
}

function loadDevKey() {
  const file = path.join(root, ".dev.vars");
  if (!fs.existsSync(file)) return "";
  const line = fs.readFileSync(file, "utf8").split(/\r?\n/).find((value) => value.startsWith("GEMINI_API_KEY="));
  return line?.slice("GEMINI_API_KEY=".length).trim() ?? "";
}

async function translateBatch(apiKey, entries) {
  const schema = {
    type: "object",
    properties: { items: { type: "array", items: { type: "object", properties: {
      word: { type: "string" }, meaning: { type: "string" },
    }, required: ["word", "meaning"], additionalProperties: false } } },
    required: ["items"], additionalProperties: false,
  };
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: "你是台灣高中英文字典編輯。為每個英文詞提供一至三個最常用、精簡且準確的繁體中文釋義。使用全形分號分隔多義，不寫例句、英文解釋或簡體字。必須原樣保留 word。" }] },
      contents: [{ role: "user", parts: [{ text: JSON.stringify(entries) }] }],
      generationConfig: { temperature: 0.1, thinkingConfig: { thinkingLevel: "low" }, responseMimeType: "application/json", responseJsonSchema: schema },
    }),
  });
  if (!response.ok) throw new Error(`Gemini ${response.status}: ${(await response.text()).slice(0, 200)}`);
  const body = await response.json();
  const text = body.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("");
  return JSON.parse(text).items;
}

async function loadEcdictMeanings(entries) {
  console.log("Gemini key unavailable; using the MIT-licensed ECDICT fallback for missing meanings.");
  const wanted = new Set(entries.map((entry) => entry.Word.toLowerCase()));
  const response = await fetch(ECDICT_CSV);
  if (!response.ok) throw new Error(`ECDICT download failed: ${response.status}`);
  const lines = (await response.text()).split(/\r?\n/);
  const meanings = {};
  for (const line of lines.slice(1)) {
    const fields = parseCsv(line)[0];
    const word = fields?.[0]?.toLowerCase();
    const translation = fields?.[3]?.replace(/\\n/g, "；").trim();
    if (word && wanted.has(word) && translation) meanings[word] = translation;
  }
  const converted = spawnSync("python", ["-c", "import json,sys; from zhconv import convert; d=json.load(sys.stdin); print(json.dumps({k:convert(v,'zh-tw') for k,v in d.items()},ensure_ascii=False))"], {
    input: JSON.stringify(meanings), encoding: "utf8", maxBuffer: 10 * 1024 * 1024,
    env: { ...process.env, PYTHONUTF8: "1" },
  });
  if (converted.status !== 0) throw new Error(`Traditional Chinese conversion failed: ${converted.stderr}`);
  return new Map(Object.entries(JSON.parse(converted.stdout)));
}

const existingRows = parseCsv(fs.readFileSync(path.join(root, "data", "words.utf8.csv"), "utf8"));
const existing = new Map(existingRows.slice(1).map(([word, pos, meaning]) => [word.toLowerCase(), { pos, meaning }]));
const response = await fetch(CEEC_JSON);
if (!response.ok) throw new Error(`CEEC source download failed: ${response.status}`);
const official = await response.json();
const apiKey = loadDevKey();
const missing = official.filter((entry) => {
  const meaning = existing.get(entry.Word.toLowerCase())?.meaning;
  return !meaning || meaning.includes("�");
});
let generated = new Map();
if (apiKey) {
  try {
    for (let i = 0; i < missing.length; i += 80) {
      const batch = missing.slice(i, i + 80).map((entry) => ({ word: entry.Word, partOfSpeech: entry.PartsOfSpeech.join("/") }));
      const translated = await translateBatch(apiKey, batch);
      for (const item of translated) if (item.word && item.meaning) generated.set(item.word.toLowerCase(), item.meaning.trim());
      console.log(`Translated ${Math.min(i + batch.length, missing.length)}/${missing.length}`);
    }
  } catch (error) {
    console.warn(String(error));
    generated = await loadEcdictMeanings(missing);
  }
} else {
  generated = await loadEcdictMeanings(missing);
}

const manualMeanings = new Map([
  ["café", "咖啡館"], ["fiancé", "未婚夫"], ["ma’am", "女士；夫人"], ["o’clock", "……點鐘"],
]);
const rows = official.map((entry) => {
  const old = existing.get(entry.Word.toLowerCase());
  const existingMeaning = old?.meaning && !old.meaning.includes("�") ? old.meaning : "";
  return { word: entry.Word, pos: entry.PartsOfSpeech.join("/"), meaning: existingMeaning || generated.get(entry.Word.toLowerCase()) || manualMeanings.get(entry.Word.toLowerCase()), level: Number(entry.Level) };
});
const unresolved = rows.filter((row) => !row.meaning);
if (unresolved.length) throw new Error(`Missing meanings for ${unresolved.length} entries: ${unresolved.slice(0, 30).map((row) => row.word).join(", ")}`);
const csvEscape = (value) => /[",\n]/.test(String(value)) ? `"${String(value).replace(/"/g, '""')}"` : String(value);
fs.writeFileSync(path.join(root, "data", "words.utf8.csv"), "word,pos,meaning,level,source\n" + rows.map((row) => [row.word, row.pos, row.meaning, row.level, "CEEC-108"].map(csvEscape).join(",")).join("\n") + "\n");
const sqlEscape = (value) => String(value).replace(/'/g, "''");
let sql = "-- Generated from the CEEC senior-high reference vocabulary list (108 curriculum).\n-- Non-commercial academic use; source: https://www.ceec.edu.tw/xmdoc?xsmsid=0K213553204833715309\n\n";
for (let i = 0; i < rows.length; i += 200) {
  sql += "INSERT INTO words (word, pos, meaning, level, source) VALUES\n" + rows.slice(i, i + 200).map((row) => `  ('${sqlEscape(row.word)}', '${sqlEscape(row.pos)}', '${sqlEscape(row.meaning)}', ${row.level}, 'CEEC-108')`).join(",\n") + "\nON CONFLICT(word) DO UPDATE SET pos=excluded.pos, meaning=excluded.meaning, level=excluded.level, source=excluded.source;\n\n";
}
fs.writeFileSync(path.join(root, "data", "seed-words.sql"), sql);
console.log(`Wrote ${rows.length} official CEEC spellings.`);
