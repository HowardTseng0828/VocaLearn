"use client";

import { useCallback, useEffect, useState } from "react";
import { api, type WordItem } from "@/lib/api";

export default function WordsPage() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<WordItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const size = 50;

  const load = useCallback(
    (query: string, p: number) => {
      setLoading(true);
      api
        .words(query, p, size)
        .then((r) => {
          setItems(r.items);
          setTotal(r.total);
        })
        .catch(() => setItems([]))
        .finally(() => setLoading(false));
    },
    []
  );

  // Debounced search.
  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      load(q, 1);
    }, 300);
    return () => clearTimeout(t);
  }, [q, load]);

  useEffect(() => {
    load(q, page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const pages = Math.max(Math.ceil(total / size), 1);

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">單字庫</h1>
        <button
          onClick={() => setShowImport((s) => !s)}
          className="btn btn-ghost !py-2 text-sm"
        >
          {showImport ? "關閉匯入" : "📥 匯入 CSV"}
        </button>
      </div>

      {showImport && <ImportPanel onDone={() => load(q, page)} />}

      <input
        className="input"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="搜尋單字或中文意思…"
      />

      <div className="text-sm text-slate-500 dark:text-slate-400">
        共 {total.toLocaleString()} 個單字
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
        </div>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {items.map((w) => (
            <li key={w.id} className="card flex items-start justify-between gap-2 p-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{w.word}</span>
                  {w.pos && <span className="text-xs text-slate-400">{w.pos}</span>}
                </div>
                <div className="truncate text-sm text-slate-500 dark:text-slate-400">
                  {w.meaning}
                </div>
              </div>
              {w.mastered === 1 ? (
                <span title="已精熟" className="shrink-0 text-brand-500">
                  ⭐
                </span>
              ) : w.seen > 0 ? (
                <span title="練習中" className="shrink-0 text-slate-300 dark:text-slate-600">
                  ●
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            className="btn btn-ghost !py-2"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(p - 1, 1))}
          >
            ← 上一頁
          </button>
          <span className="text-sm text-slate-500">
            {page} / {pages}
          </span>
          <button
            className="btn btn-ghost !py-2"
            disabled={page >= pages}
            onClick={() => setPage((p) => Math.min(p + 1, pages))}
          >
            下一頁 →
          </button>
        </div>
      )}
    </div>
  );
}

function ImportPanel({ onDone }: { onDone: () => void }) {
  const [csv, setCsv] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setCsv(text);
  }

  async function doImport() {
    setBusy(true);
    setMsg("");
    try {
      const r = await api.importCsv(csv);
      setMsg(
        `解析 ${r.parsed} 筆，新增 ${r.imported} 筆，略過 ${r.skipped} 筆重複。題庫現有 ${r.total} 字。`
      );
      setCsv("");
      onDone();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "匯入失敗");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card space-y-3 p-4">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        支援 <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">word,pos,meaning</code>{" "}
        三欄，或{" "}
        <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">word,詞性+中文意思</code>{" "}
        兩欄格式（會自動跳過重複單字）。
      </p>
      <input type="file" accept=".csv,text/csv" onChange={handleFile} className="text-sm" />
      <textarea
        className="input min-h-[120px] font-mono text-xs"
        value={csv}
        onChange={(e) => setCsv(e.target.value)}
        placeholder={"word,pos,meaning\nresilient,adj.,有彈性的；適應力強的"}
      />
      <div className="flex items-center gap-3">
        <button
          className="btn btn-primary"
          disabled={busy || !csv.trim()}
          onClick={doImport}
        >
          {busy ? "匯入中…" : "匯入"}
        </button>
        {msg && <span className="text-sm text-slate-600 dark:text-slate-300">{msg}</span>}
      </div>
    </div>
  );
}
