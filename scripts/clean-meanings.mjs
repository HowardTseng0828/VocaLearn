// Cleans data/words.utf8.csv in place and regenerates data/seed-words.sql.
// Usage: npm run words:clean
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cleanMeaning } from "./lib/clean-meaning.mjs";
import { parseCsv, writeWordFiles } from "./lib/word-files.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const csvPath = path.join(root, "data", "words.utf8.csv");
const [header, ...rows] = parseCsv(fs.readFileSync(csvPath, "utf8"));
if (header.join(",") !== "word,pos,meaning,level,source") throw new Error(`Unexpected header: ${header.join(",")}`);

let changed = 0;
const cleaned = rows.map(([word, pos, meaning, level, source]) => {
  const next = cleanMeaning(meaning, word);
  if (next !== meaning) changed++;
  return { word, pos, meaning: next, level: Number(level), source };
});

writeWordFiles(root, cleaned);
console.log(`Cleaned ${changed} of ${cleaned.length} meanings.`);
