"use client";

import { useCallback, useEffect, useState } from "react";
import { api, type WordItem } from "@/lib/api";
import { formatPartOfSpeech, LOCALES, type Locale } from "@/lib/i18n";
import { SpeakButton } from "@/components/SpeakButton";
import { useApp } from "@/lib/store";

export default function WordsPage() {
  const { user, t, locale, course } = useApp();
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
    // Reload when the page or the course / meaning language changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, user?.targetLang, locale]);

  const pages = Math.max(Math.ceil(total / size), 1);

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold">{t("words.title")}{course ? ` · ${course.name}` : ""}</h1>
        {user?.role === "admin" && <button
          onClick={() => setShowImport((s) => !s)}
          className="btn btn-ghost !py-2 text-xs"
        >
          {showImport ? t("words.closeImport") : t("words.import")}
        </button>}
      </div>

      {showImport && user?.role === "admin" && <ImportPanel onDone={() => load(q, page)} />}

      <input
        className="input"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t("words.search")}
      />

      <div className="text-sm font-bold text-slate-500 dark:text-slate-400">
        {t("words.total", { n: total.toLocaleString() })}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-9 w-9 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
        </div>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {items.map((w) => (
            <li key={w.id} className="card flex items-start justify-between gap-2 p-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold">{w.word}</span>
                  {w.pos && <span className="text-xs font-bold text-slate-400">{formatPartOfSpeech(w.pos, locale)}</span>}
                </div>
                <div className="truncate text-sm font-medium text-slate-500 dark:text-slate-400">
                  {w.meaning}
                </div>
              </div>
              <SpeakButton text={w.word} compact />
              {w.mastered === 1 ? (
                <span title={t("words.mastered")} className="shrink-0 text-lg">
                  ⭐
                </span>
              ) : w.seen > 0 ? (
                <span title={t("words.practicing")} className="shrink-0 text-brand-300 dark:text-brand-700">
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
            {t("words.prev")}
          </button>
          <span className="text-sm text-slate-500">
            {page} / {pages}
          </span>
          <button
            className="btn btn-ghost !py-2"
            disabled={page >= pages}
            onClick={() => setPage((p) => Math.min(p + 1, pages))}
          >
            {t("words.next")}
          </button>
        </div>
      )}
    </div>
  );
}

function ImportPanel({ onDone }: { onDone: () => void }) {
  const { t, errorText, languages, user } = useApp();
  const [lang, setLang] = useState(user?.targetLang ?? "en");
  // "" = new words; otherwise translations for that learner locale.
  const [meaningLocale, setMeaningLocale] = useState<Locale | "">("");
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
      const r = await api.importCsv(csv, lang, meaningLocale || undefined);
      setMsg(t("words.importResult", r));
      setCsv("");
      onDone();
    } catch (err) {
      setMsg(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card space-y-3 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-extrabold text-slate-500">
          {t("words.importCourse")}
          <select className="input mt-1" value={lang} onChange={(e) => setLang(e.target.value)}>
            {languages.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
          </select>
        </label>
        <label className="text-xs font-extrabold text-slate-500">
          {t("words.importKind")}
          <select className="input mt-1" value={meaningLocale} onChange={(e) => setMeaningLocale(e.target.value as Locale | "")}>
            <option value="">{t("words.importKindWords")}</option>
            {LOCALES.map((l) => <option key={l.code} value={l.code}>{t("words.importKindMeanings", { locale: l.label })}</option>)}
          </select>
        </label>
      </div>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        {meaningLocale ? t("words.importHelpMeanings") : t("words.importHelp")}
      </p>
      <input type="file" accept=".csv,text/csv" onChange={handleFile} className="text-sm" />
      <textarea
        className="input min-h-[120px] font-mono text-xs"
        value={csv}
        onChange={(e) => setCsv(e.target.value)}
        placeholder={meaningLocale ? "word,meaning\nresilient,resilient; able to recover" : "word,pos,meaning,level\nresilient,adj.,有彈性的；適應力強的,5"}
      />
      <div className="flex items-center gap-3">
        <button
          className="btn btn-primary"
          disabled={busy || !csv.trim()}
          onClick={doImport}
        >
          {busy ? t("words.importing") : t("words.importButton")}
        </button>
        {msg && <span className="text-sm text-slate-600 dark:text-slate-300">{msg}</span>}
      </div>
    </div>
  );
}
