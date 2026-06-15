"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, type Stats } from "@/lib/api";
import { useApp } from "@/lib/store";

const MODES = [
  { key: "random", label: "隨機抽考", desc: "混合所有題型", icon: "🎲" },
  { key: "en2zh", label: "英翻中", desc: "看英文選中文", icon: "🇬🇧" },
  { key: "zh2en", label: "中翻英", desc: "看中文選英文", icon: "🇹🇼" },
  { key: "spell", label: "拼字測驗", desc: "聽意思拼單字", icon: "⌨️" },
  { key: "cloze", label: "AI 填空", desc: "AI 例句填空", icon: "🤖" },
];

export default function HomePage() {
  const { user } = useApp();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    api.stats().then(setStats).catch(() => {});
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      <section className="card overflow-hidden">
        <div className="bg-gradient-to-br from-brand-600 to-brand-800 p-6 text-white">
          <p className="text-sm/relaxed opacity-90">歡迎回來，</p>
          <h1 className="text-2xl font-bold">{user?.displayName || "同學"} 👋</h1>
          <p className="mt-1 text-sm opacity-90">
            今天也來練幾個單字吧！
            {stats && stats.streak > 0 && (
              <span className="ml-1 font-semibold">🔥 連續 {stats.streak} 天</span>
            )}
          </p>
          <Link
            href="/practice?mode=random&daily=1"
            className="mt-4 inline-flex rounded-xl bg-white/95 px-5 py-2.5 text-sm font-bold text-brand-700 transition hover:bg-white"
          >
            開始每日練習 →
          </Link>
        </div>
      </section>

      {/* Quick stats */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="已學單字" value={stats?.seen} suffix={`/${stats?.totalWords ?? "—"}`} />
        <StatCard label="已精熟" value={stats?.mastered} accent />
        <StatCard label="正確率" value={stats ? `${stats.accuracy}%` : undefined} />
        <StatCard label="待複習錯題" value={stats?.openWrong} warn />
      </section>

      {/* Practice modes */}
      <section>
        <h2 className="mb-3 text-lg font-bold">選擇練習模式</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MODES.map((m) => (
            <Link
              key={m.key}
              href={`/practice?mode=${m.key}`}
              className="card flex items-center gap-4 p-4 transition hover:border-brand-300 hover:shadow-md dark:hover:border-brand-700"
            >
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand-50 text-2xl dark:bg-brand-900/40">
                {m.icon}
              </span>
              <div>
                <div className="font-semibold">{m.label}</div>
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  {m.desc}
                </div>
              </div>
            </Link>
          ))}
          {stats && stats.openWrong > 0 && (
            <Link
              href="/practice?mode=random&review=1"
              className="card flex items-center gap-4 border-amber-200 bg-amber-50/50 p-4 transition hover:shadow-md dark:border-amber-900/50 dark:bg-amber-950/20"
            >
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-amber-100 text-2xl dark:bg-amber-900/40">
                🔁
              </span>
              <div>
                <div className="font-semibold">複習錯題</div>
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  {stats.openWrong} 個待複習
                </div>
              </div>
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  suffix,
  accent,
  warn,
}: {
  label: string;
  value?: number | string;
  suffix?: string;
  accent?: boolean;
  warn?: boolean;
}) {
  return (
    <div className="card p-4">
      <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
      <div
        className={`mt-1 text-2xl font-bold ${
          accent
            ? "text-brand-600 dark:text-brand-300"
            : warn
              ? "text-amber-600 dark:text-amber-400"
              : ""
        }`}
      >
        {value ?? "—"}
        {suffix && (
          <span className="text-sm font-normal text-slate-400">{suffix}</span>
        )}
      </div>
    </div>
  );
}
