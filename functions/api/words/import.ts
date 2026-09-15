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
  level: number | null;
  source: string;
}

// POST /api/words/import — bulk-import vocabulary from CSV text.
// Accepts a 2-column file (word,"<pos><meaning>") or a file of 3 columns or
// more (word,pos,meaning[,level[,source]]); a header row is auto-detected and
// skipped. level drives the learning-path order, so data/words.utf8.csv keeps
// it — importing without it would push those words to the end of the path.
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const user = await getUser(request, env);
  if (!user) return error("未登入", 401);

  if (user.role !== "admin") return error("只有管理員可以匯入單字", 403);

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
    const levelRaw = parseInt((row[3] ?? "").trim(), 10);
    const level = Number.isFinite(levelRaw) ? levelRaw : null;
    const source = (row[4] ?? "").trim() || "import";
    parsed.push({ word, pos, meaning, level, source });
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
        "INSERT OR IGNORE INTO words (word, pos, meaning, level, source) VALUES (?, ?, ?, ?, ?)"
      ).bind(w.word, w.pos, w.meaning, w.level, w.source)
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
