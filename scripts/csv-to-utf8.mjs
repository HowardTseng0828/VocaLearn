// Decode the Big5 master vocab list to a clean UTF-8 CSV.
// Source format per line: `<word>,<pos><chinese-meaning>` where <pos> is
// like "v.", "n.", "adj.", "prep./adv." etc. The part-of-speech and the
// meaning are not separated by a delimiter, so we split them heuristically.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const buf = fs.readFileSync(path.join(root, "7000vocs.csv"));
// Node has no built-in Big5 decoder; use a TextDecoder label it does support.
// "big5" is supported by the ICU-backed TextDecoder in Node 18+.
const text = new TextDecoder("big5").decode(buf);

// Normalize all CR / CRLF / CRCRLF variants to a single \n.
const lines = text
  .replace(/\r\n?/g, "\n")
  .split("\n")
  .map((l) => l.trim())
  .filter((l) => l.length > 0);

// Match a leading part-of-speech token: one or more "<letters>." groups,
// optionally joined by "/", optionally repeated (the source has a few
// "adj. adj." style duplicates and "prep./adv." style compounds).
const posRe = /^((?:[a-z]+\.\s*)(?:\/\s*[a-z]+\.\s*)*)+/i;

const rows = [];
const seen = new Set();
for (const line of lines) {
  const comma = line.indexOf(",");
  if (comma === -1) continue;
  const word = line.slice(0, comma).trim();
  let rest = line.slice(comma + 1).trim();
  if (!word) continue;

  let pos = "";
  const m = rest.match(posRe);
  if (m) {
    pos = m[0].replace(/\s+/g, " ").trim();
    rest = rest.slice(m[0].length).trim();
    // Drop space-separated duplicate tokens like "adj. adj." -> "adj."
    const parts = pos.split(" ");
    const deduped = parts.filter((p, idx) => parts.indexOf(p) === idx);
    pos = deduped.join(" ");
  }
  const meaning = rest;
  if (!meaning) continue;

  // De-dupe on the lowercased word (the source has a handful of repeats).
  const key = word.toLowerCase();
  if (seen.has(key)) continue;
  seen.add(key);

  rows.push({ word, pos, meaning });
}

// Write a clean UTF-8 CSV (word,pos,meaning) for the in-app importer / inspection.
const csvEscape = (s) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
const csvOut =
  "word,pos,meaning\n" +
  rows.map((r) => [r.word, r.pos, r.meaning].map(csvEscape).join(",")).join("\n") +
  "\n";
fs.writeFileSync(path.join(root, "data", "words.utf8.csv"), csvOut);

// Write a D1 seed SQL file (chunked multi-row INSERTs).
const sqlEscape = (s) => s.replace(/'/g, "''");
const chunkSize = 200;
let sql =
  "-- Auto-generated from 7000vocs.csv. Do not edit by hand.\n" +
  "-- Regenerate with: npm run seed:gen\n\n";
for (let i = 0; i < rows.length; i += chunkSize) {
  const chunk = rows.slice(i, i + chunkSize);
  sql += "INSERT OR IGNORE INTO words (word, pos, meaning) VALUES\n";
  sql += chunk
    .map(
      (r) =>
        `  ('${sqlEscape(r.word)}', '${sqlEscape(r.pos)}', '${sqlEscape(r.meaning)}')`
    )
    .join(",\n");
  sql += ";\n\n";
}
fs.mkdirSync(path.join(root, "migrations"), { recursive: true });
fs.writeFileSync(path.join(root, "data", "seed-words.sql"), sql);

console.log(`Parsed ${rows.length} unique words.`);
console.log(`Wrote data/words.utf8.csv and data/seed-words.sql`);
// Print a few samples for a sanity check.
for (const r of rows.slice(0, 5)) {
  console.log(`  ${r.word} | ${r.pos} | ${r.meaning}`);
}
