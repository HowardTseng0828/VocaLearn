"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, type WrongAnswer } from "@/lib/api";
import { formatPartOfSpeech } from "@/lib/i18n";
import { useApp } from "@/lib/store";

export default function NotebookPage() {
  const { t, locale } = useApp();
  const [items, setItems] = useState<WrongAnswer[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(true);

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

  async function remove(id: number) {
    await api.deleteWrong(id).catch(() => {});
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold">{t("notebook.title")}</h1>
        {items.length > 0 && (<>
          <Link href="/practice?mode=random&reviewCorrect=1" className="btn btn-ghost !py-2 text-xs">{t("notebook.reviewCorrect")}</Link>
          <Link href="/practice?mode=random&review=1" className="btn btn-blue !py-2 text-xs">
            {t("notebook.reviewWrongCta")}
          </Link>
        </>)}
      </div>

      <section className="grid gap-3 sm:grid-cols-2">
        <Link href="/practice?mode=random&review=1" className="card border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-950/20">
          <div className="font-extrabold text-red-700 dark:text-red-300">{t("notebook.reviewWrong")}</div>
          <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">{t("notebook.reviewWrongDesc")}</div>
        </Link>
        <Link href="/practice?mode=random&reviewCorrect=1" className="card border-brand-200 bg-brand-50 p-4 dark:border-brand-900/50 dark:bg-brand-950/20">
          <div className="font-extrabold text-brand-700 dark:text-brand-300">{t("notebook.reviewCorrect")}</div>
          <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">{t("notebook.reviewCorrectDesc")}</div>
        </Link>
      </section>

      <div className="flex rounded-2xl bg-slate-100 p-1.5 dark:bg-slate-800">
        {[
          { v: false, label: t("notebook.open") },
          { v: true, label: t("notebook.all") },
        ].map((t) => (
          <button
            key={String(t.v)}
            onClick={() => setShowAll(t.v)}
            className={`flex-1 rounded-xl py-2 text-sm font-extrabold transition ${
              showAll === t.v
                ? "bg-white text-brand-600 shadow-sm dark:bg-slate-700 dark:text-brand-300"
                : "text-slate-400"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-9 w-9 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
        </div>
      ) : items.length === 0 ? (
        <div className="card p-10 text-center animate-bounce-in">
          <div className="text-5xl">{showAll ? "📕" : "🎉"}</div>
          <p className="mt-3 font-extrabold">
            {showAll ? t("notebook.emptyAll") : t("notebook.emptyOpen")}
          </p>
          <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
            {t("notebook.emptyHint")}
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((it) => (
            <li
              key={it.id}
                className={`card flex items-center justify-between gap-3 border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-950/20 ${it.resolved === 1 ? "opacity-70" : ""}`}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-extrabold">{it.word}</span>
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
                className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-red-500 dark:hover:bg-slate-800"
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
