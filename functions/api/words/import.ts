import type { Env } from "../../_lib/types";
import { json, error, readJson } from "../../_lib/http";
import { getUser } from "../../_lib/auth";
import { parseCsv, splitPosMeaning } from "../../_lib/csv";

interface Body {
  csv?: string;
}

interface ParsedWord {
  word: string;
  pos: string;
  meaning: string;
}

// POST /api/words/import — bulk-import vocabulary from CSV text.
// Accepts either a 3-column file (word,pos,meaning) or a 2-column file
// (word,"<pos><meaning>"); a header row is auto-detected and skipped.
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const user = await getUser(request, env);
  if (!user) return error("未登入", 401);

  const body = await readJson<Body>(request);
  const csv = body?.csv;
  if (!csv || csv.trim().length === 0) return error("CSV 內容為空");

  const rows = parseCsv(csv);
  const parsed: ParsedWord[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 2) continue;
    const word = (row[0] ?? "").trim();
    if (!word) continue;

    // Skip an obvious header row.
    if (i === 0 && /^word$/i.test(word)) continue;

    let pos = "";
    let meaning = "";
    if (row.length >= 3) {
      pos = (row[1] ?? "").trim();
      meaning = (row[2] ?? "").trim();
    } else {
      const split = splitPosMeaning((row[1] ?? "").trim());
      pos = split.pos;
      meaning = split.meaning;
    }
    if (!meaning) continue;
    parsed.push({ word, pos, meaning });
  }

  if (parsed.length === 0) return error("沒有可匯入的有效資料");

  // Insert in batches (D1 supports batched statements). INSERT OR IGNORE keeps
  // existing words untouched (word is UNIQUE).
  const batchSize = 100;
  let imported = 0;
  for (let i = 0; i < parsed.length; i += batchSize) {
    const chunk = parsed.slice(i, i + batchSize);
    const statements = chunk.map((w) =>
      env.DB.prepare(
        "INSERT OR IGNORE INTO words (word, pos, meaning) VALUES (?, ?, ?)"
      ).bind(w.word, w.pos, w.meaning)
    );
    const results = await env.DB.batch(statements);
    imported += results.reduce(
      (sum, r) => sum + ((r.meta?.changes as number) ?? 0),
      0
    );
  }

  const total = await env.DB.prepare("SELECT COUNT(*) AS n FROM words").first<{
    n: number;
  }>();

  return json({
    parsed: parsed.length,
    imported,
    skipped: parsed.length - imported,
    total: total?.n ?? 0,
  });
};
