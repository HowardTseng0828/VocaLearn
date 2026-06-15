"use client";

import { useEffect, useState } from "react";
import { api, type Stats } from "@/lib/api";

export default function StatsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .stats()
      .then(setStats)
      .catch((e) => setError(e instanceof Error ? e.message : "載入失敗"));
  }, []);

  if (error)
    return <p className="text-sm font-bold text-mode-red">{error}</p>;
  if (!stats)
    return (
      <div className="flex justify-center py-24">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    );

  const masteredPct =
    stats.totalWords > 0
      ? Math.round((stats.mastered / stats.totalWords) * 100)
      : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-xl font-extrabold">學習進度</h1>

      {/* 連續天數大卡 + 精熟進度環 */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="card flex items-center gap-4 p-5">
          <span className="animate-flame text-5xl">🔥</span>
          <div>
            <div className="text-3xl font-extrabold text-mode-orange">
              {stats.streak}
            </div>
            <div className="text-sm font-bold text-slate-500 dark:text-slate-400">
              連續練習天數
            </div>
          </div>
        </div>

        <div className="card flex items-center gap-4 p-5">
          <Ring pct={masteredPct} />
          <div>
            <div className="text-sm font-bold text-slate-500 dark:text-slate-400">
              精熟進度
            </div>
            <div className="text-lg font-extrabold">
              {stats.mastered}
              <span className="text-sm font-bold text-slate-400">
                {" "}
                / {stats.totalWords}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 四格數據 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric icon="🎯" label="正確率" value={`${stats.accuracy}%`} />
        <Metric icon="📝" label="總作答" value={stats.attempts} />
        <Metric icon="✅" label="答對" value={stats.correct} />
        <Metric icon="📖" label="已學單字" value={stats.seen} />
      </div>

      {/* 精熟進度條 */}
      <div className="card p-5">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-extrabold">精熟進度</h2>
          <span className="text-sm font-bold text-slate-500">
            {masteredPct}%
          </span>
        </div>
        <div className="progress-track shimmer">
          <div className="progress-fill" style={{ width: `${masteredPct}%` }} />
        </div>
        <p className="mt-3 text-sm font-medium text-slate-500 dark:text-slate-400">
          已接觸 {stats.seen} 個單字，其中 {stats.mastered} 個達到精熟（連續答對 3
          次）。
        </p>
      </div>

      {/* 活動熱力圖 */}
      <div className="card p-5">
        <h2 className="mb-3 font-extrabold">近期練習</h2>
        <Heatmap activity={stats.activity} />
      </div>
    </div>
  );
}

// SVG 進度環
function Ring({ pct }: { pct: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return (
    <div className="relative h-16 w-16 shrink-0">
      <svg className="h-16 w-16 -rotate-90" viewBox="0 0 64 64">
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          strokeWidth="7"
          className="stroke-slate-200 dark:stroke-slate-800"
        />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="stroke-brand-500 transition-all duration-700"
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-sm font-extrabold">
        {pct}%
      </span>
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: number | string;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400">
        <span>{icon}</span>
        {label}
      </div>
      <div className="mt-1 text-2xl font-extrabold">{value}</div>
    </div>
  );
}

// GitHub 風格貢獻熱力圖（近 90 天）
function Heatmap({
  activity,
}: {
  activity: { day: string; answered: number; correct: number }[];
}) {
  const map = new Map(activity.map((a) => [a.day, a.answered]));
  const days: { day: string; count: number }[] = [];
  const cursor = new Date();
  cursor.setUTCDate(cursor.getUTCDate() - 90);
  for (let i = 0; i <= 90; i++) {
    const key = cursor.toISOString().slice(0, 10);
    days.push({ day: key, count: map.get(key) ?? 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const level = (c: number) =>
    c === 0
      ? "bg-slate-100 dark:bg-slate-800"
      : c < 5
        ? "bg-brand-200 dark:bg-brand-900"
        : c < 15
          ? "bg-brand-400 dark:bg-brand-700"
          : "bg-brand-500 dark:bg-brand-500";

  return (
    <div className="overflow-x-auto">
      <div className="grid grid-flow-col grid-rows-7 gap-1">
        {days.map((d) => (
          <div
            key={d.day}
            title={`${d.day}：${d.count} 題`}
            className={`h-3.5 w-3.5 rounded-[4px] ${level(d.count)}`}
          />
        ))}
      </div>
      <div className="mt-3 flex items-center gap-1.5 text-xs font-bold text-slate-400">
        <span>少</span>
        <span className="h-3 w-3 rounded-[4px] bg-slate-100 dark:bg-slate-800" />
        <span className="h-3 w-3 rounded-[4px] bg-brand-200 dark:bg-brand-900" />
        <span className="h-3 w-3 rounded-[4px] bg-brand-400 dark:bg-brand-700" />
        <span className="h-3 w-3 rounded-[4px] bg-brand-500" />
        <span>多</span>
      </div>
    </div>
  );
}
