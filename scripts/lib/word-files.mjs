// Shared CSV parsing and writers for data/words.utf8.csv and data/seed-words.sql.
import fs from "node:fs";
import path from "node:path";

export function parseCsv(text) {
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

const csvEscape = (value) => /[",\n]/.test(String(value)) ? `"${String(value).replace(/"/g, '""')}"` : String(value);
const sqlEscape = (value) => String(value).replace(/'/g, "''");

// rows: { word, pos, meaning, level, source }[] — all English (lang 'en').
export function writeWordFiles(root, rows) {
  fs.writeFileSync(
    path.join(root, "data", "words.utf8.csv"),
    "word,pos,meaning,level,source\n" + rows.map((row) => [row.word, row.pos, row.meaning, row.level, row.source].map(csvEscape).join(",")).join("\n") + "\n"
  );
  let sql = "-- Generated from the CEEC senior-high reference vocabulary list (108 curriculum).\n-- Non-commercial academic use; source: https://www.ceec.edu.tw/xmdoc?xsmsid=0K213553204833715309\n-- Requires migrations up to 0009 (words.lang). Run `npm run words:reindex:*` afterwards.\n\n";
  for (let i = 0; i < rows.length; i += 200) {
    sql += "INSERT INTO words (lang, word, pos, meaning, level, source) VALUES\n" +
      rows.slice(i, i + 200).map((row) => `  ('en', '${sqlEscape(row.word)}', '${sqlEscape(row.pos)}', '${sqlEscape(row.meaning)}', ${row.level}, '${sqlEscape(row.source)}')`).join(",\n") +
      "\nON CONFLICT(lang, word) DO UPDATE SET pos=excluded.pos, meaning=excluded.meaning, level=excluded.level, source=excluded.source;\n\n";
  }
  fs.writeFileSync(path.join(root, "data", "seed-words.sql"), sql);
}
