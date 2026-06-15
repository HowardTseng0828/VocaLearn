"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, type WrongAnswer, type QuizMode } from "@/lib/api";

const MODE_LABEL: Record<QuizMode, string> = {
  en2zh: "英翻中",
  zh2en: "中翻英",
  spell: "拼字",
  cloze: "AI 填空",
};

export default function NotebookPage() {
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
        <h1 className="text-xl font-extrabold">錯題本</h1>
        {items.length > 0 && (
          <Link href="/practice?mode=random&review=1" className="btn btn-blue !py-2 text-xs">
            複習錯題 →
          </Link>
        )}
      </div>

      <div className="flex rounded-2xl bg-slate-100 p-1.5 dark:bg-slate-800">
        {[
          { v: false, label: "待複習" },
          { v: true, label: "全部" },
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
            {showAll ? "還沒有任何錯題紀錄" : "沒有待複習的錯題"}
          </p>
          <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
            做幾題練習後，答錯的單字會自動收進這裡。
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((it) => (
            <li
              key={it.id}
              className="card flex items-center justify-between gap-3 p-4"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-extrabold">{it.word}</span>
                  {it.pos && (
                    <span className="text-xs font-bold text-slate-400">{it.pos}</span>
                  )}
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500 dark:bg-slate-800">
                    {MODE_LABEL[it.mode]}
                  </span>
                  {it.resolved === 1 && (
                    <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-bold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                      ✓ 已訂正
                    </span>
                  )}
                </div>
                <div className="mt-0.5 truncate text-sm font-medium text-slate-500 dark:text-slate-400">
                  {it.meaning}
                </div>
                {it.your_answer && (
                  <div className="mt-0.5 text-xs font-bold text-mode-red">
                    你的答案：{it.your_answer}
                  </div>
                )}
              </div>
              <button
                onClick={() => remove(it.id)}
                className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-red-500 dark:hover:bg-slate-800"
                title="移除"
                aria-label="移除"
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
