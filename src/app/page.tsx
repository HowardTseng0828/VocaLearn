"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, type Stats } from "@/lib/api";
import { useApp } from "@/lib/store";

// 各題型的專屬配色（Duolingo 風）
const MODES = [
  { key: "random", label: "隨機抽考", desc: "混合所有題型", icon: "🎲", color: "#58cc02", shadow: "#46a302" },
  { key: "en2zh", label: "英翻中", desc: "看英文選中文", icon: "🇬🇧", color: "#1cb0f6", shadow: "#1387c4" },
  { key: "zh2en", label: "中翻英", desc: "看中文選英文", icon: "🇹🇼", color: "#ff9600", shadow: "#cc7800" },
  { key: "spell", label: "拼字測驗", desc: "聽意思拼單字", icon: "⌨️", color: "#ce82ff", shadow: "#a855e0" },
  { key: "cloze", label: "AI 填空", desc: "AI 例句填空", icon: "🤖", color: "#ff86d0", shadow: "#e05cae" },
];

export default function HomePage() {
  const { user } = useApp();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    api.stats().then(setStats).catch(() => {});
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hero */}
      <section className="card relative overflow-hidden border-0 !p-0">
        <div className="relative bg-gradient-to-br from-brand-400 via-brand-500 to-brand-600 p-6 text-white">
          {/* 裝飾圓 */}
          <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -bottom-10 right-16 h-24 w-24 rounded-full bg-white/10" />

          <div className="relative flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold opacity-90">歡迎回來，</p>
              <h1 className="text-2xl font-extrabold">{user?.displayName || "同學"} 👋</h1>
              <p className="mt-1 text-sm font-medium opacity-90">今天也來練幾個單字吧！</p>
            </div>
            {stats && stats.streak > 0 && (
              <div className="flex shrink-0 flex-col items-center rounded-2xl bg-white/15 px-3 py-2 backdrop-blur">
                <span className="animate-flame text-2xl">🔥</span>
                <span className="text-lg font-extrabold leading-none">{stats.streak}</span>
                <span className="text-[10px] font-bold opacity-90">連續天數</span>
              </div>
            )}
          </div>

          <Link
            href="/practice?mode=random&daily=1"
            className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-white px-6 py-3 text-sm font-extrabold uppercase tracking-wide text-brand-600 shadow-[0_4px_0_0_rgba(0,0,0,0.12)] transition active:translate-y-0.5"
          >
            開始每日練習 →
          </Link>
        </div>
      </section>

      {/* Quick stats */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon="📖" label="已學單字" value={stats?.seen} suffix={`/${stats?.totalWords ?? "—"}`} />
        <StatCard icon="⭐" label="已精熟" value={stats?.mastered} accent />
        <StatCard icon="🎯" label="正確率" value={stats ? `${stats.accuracy}%` : undefined} />
        <StatCard icon="🔁" label="待複習" value={stats?.openWrong} warn />
      </section>

      {/* Practice modes */}
      <section>
        <h2 className="mb-3 text-lg font-extrabold">選擇練習模式</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MODES.map((m) => (
            <Link
              key={m.key}
              href={`/practice?mode=${m.key}`}
              className="card group flex items-center gap-4 p-4 transition active:translate-y-0.5"
            >
              <span
                className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-2xl transition group-hover:scale-105"
                style={{ backgroundColor: m.color, boxShadow: `0 4px 0 0 ${m.shadow}` }}
              >
                {m.icon}
              </span>
              <div>
                <div className="font-extrabold">{m.label}</div>
                <div className="text-sm font-medium text-slate-500 dark:text-slate-400">{m.desc}</div>
              </div>
            </Link>
          ))}
          {stats && stats.openWrong > 0 && (
            <Link
              href="/practice?mode=random&review=1"
              className="card group flex items-center gap-4 border-amber-200 bg-amber-50/60 p-4 transition active:translate-y-0.5 dark:border-amber-900/50 dark:bg-amber-950/20"
            >
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-mode-gold text-2xl shadow-[0_4px_0_0_#d4a700] transition group-hover:scale-105">
                🔁
              </span>
              <div>
                <div className="font-extrabold">複習錯題</div>
                <div className="text-sm font-medium text-slate-500 dark:text-slate-400">
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
  icon,
  label,
  value,
  suffix,
  accent,
  warn,
}: {
  icon: string;
  label: string;
  value?: number | string;
  suffix?: string;
  accent?: boolean;
  warn?: boolean;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400">
        <span>{icon}</span>
        {label}
      </div>
      <div
        className={`mt-1 text-2xl font-extrabold ${
          accent
            ? "text-brand-500"
            : warn
              ? "text-mode-orange"
              : ""
        }`}
      >
        {value ?? "—"}
        {suffix && <span className="text-sm font-bold text-slate-400">{suffix}</span>}
      </div>
    </div>
  );
}
