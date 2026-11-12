"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, type Stats, type WrongAnswer } from "@/lib/api";
import { formatPartOfSpeech } from "@/lib/i18n";
import { useApp } from "@/lib/store";

export default function NotebookPage() {
  const { t, locale } = useApp();
  const [items, setItems] = useState<WrongAnswer[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);

  function load(all: boolean) {
    setLoading(true);
    api
      .wrongAnswers(all)
      .then((r) => setItems(r.items))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load(showAll);
  }, [showAll]);

  useEffect(() => {
    api.stats().then(setStats).catch(() => {});
  }, []);

  async function remove(id: number) {
    await api.deleteWrong(id).catch(() => {});
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  // The open list only holds unresolved items; "all" also carries fixed ones.
  const openCount = items.filter((it) => it.resolved !== 1).length;

  return (
    <div className="flex h-full flex-col gap-3 animate-fade-in sm:gap-4">
      <h1 className="page-title">{t("nav.review")}</h1>

      {/* Primary action: review mistakes. Secondary: revisit known words. */}
      <section className="grid shrink-0 gap-3 sm:grid-cols-2">
        {openCount > 0 || loading ? (
          <Link
            href="/practice?mode=random&review=1"
            className="btn btn-primary w-full !justify-start gap-4 !px-5 !py-4 text-left normal-case tracking-normal"
          >
            <span className="text-3xl">🔁</span>
            <span className="min-w-0">
              <span className="block text-lg">{loading ? t("notebook.reviewWrong") : t("notebook.startReview", { n: openCount })}</span>
              <span className="block text-sm font-bold opacity-90">{t("notebook.reviewWrongDesc")}</span>
            </span>
          </Link>
        ) : (
          <div className="card flex items-center gap-4 px-5 py-4">
            <span className="text-3xl">🎉</span>
            <span className="text-lg font-extrabold text-brand-600 dark:text-brand-300">{t("notebook.allClear")}</span>
          </div>
        )}
        {stats && stats.correct === 0 ? (
          <Link href="/practice?mode=random" className="card flex items-center gap-4 px-5 py-4">
            <span className="text-3xl grayscale">⭐</span>
            <span className="min-w-0">
              <span className="block text-lg font-extrabold text-slate-500 dark:text-slate-400">{t("notebook.reviewCorrect")}</span>
              <span className="block text-sm font-bold text-slate-400">{t("notebook.noCorrect")} →</span>
            </span>
          </Link>
        ) : (
          <Link
            href="/practice?mode=random&reviewCorrect=1"
            className="btn btn-blue w-full !justify-start gap-4 !px-5 !py-4 text-left normal-case tracking-normal"
          >
            <span className="text-3xl">⭐</span>
            <span className="min-w-0">
              <span className="block text-lg">{t("notebook.reviewCorrect")}</span>
              <span className="block text-sm font-bold opacity-90">{t("notebook.reviewCorrectDesc")}</span>
            </span>
          </Link>
        )}
      </section>

      <div className="flex shrink-0 items-center justify-between gap-3 pt-1">
        <h2 className="section-title">{t("notebook.listTitle")}</h2>
        <div className="flex rounded-2xl bg-slate-100 p-1 dark:bg-slate-800">
          {[
            { v: false, label: t("notebook.open") },
            { v: true, label: t("notebook.all") },
          ].map((tab) => (
            <button
              key={String(tab.v)}
              onClick={() => setShowAll(tab.v)}
              className={`rounded-xl px-4 py-2 text-sm font-extrabold transition ${
                showAll === tab.v
                  ? "bg-white text-brand-600 shadow-sm dark:bg-slate-700 dark:text-brand-300"
                  : "text-slate-400"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-9 w-9 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
        </div>
      ) : items.length === 0 ? (
        <div className="card flex flex-1 flex-col items-center justify-center p-6 text-center animate-bounce-in sm:p-10">
          <div className="text-5xl">{showAll ? "📕" : "🎉"}</div>
          <p className="mt-3 font-extrabold">
            {showAll ? t("notebook.emptyAll") : t("notebook.emptyOpen")}
          </p>
          <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
            {t("notebook.emptyHint")}
          </p>
        </div>
      ) : (
        <ul className="-mx-1 min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-1 pb-1">
          {items.map((it) => (
            <li
              key={it.id}
                className={`card flex items-center justify-between gap-3 p-4 ${it.resolved === 1 ? "opacity-60" : "border-l-4 border-l-mode-red"}`}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-lg font-extrabold">{it.word}</span>
                  {it.pos && (
                    <span className="text-xs font-bold text-slate-400">{formatPartOfSpeech(it.pos, locale)}</span>
                  )}
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500 dark:bg-slate-800">
                    {t(`mode.${it.mode}`)}
                  </span>
                  {it.resolved === 1 && (
                    <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-bold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                      {t("notebook.fixed")}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 truncate text-sm font-medium text-slate-500 dark:text-slate-400">
                  {it.meaning}
                </div>
                {it.your_answer && (
                  <div className="mt-0.5 text-xs font-bold text-mode-red">
                    {t("notebook.yourAnswer", { text: it.your_answer })}
                  </div>
                )}
              </div>
              <button
                onClick={() => remove(it.id)}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-red-500 dark:hover:bg-slate-800"
                title={t("notebook.remove")}
                aria-label={t("notebook.remove")}
              >
                🗑️
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
