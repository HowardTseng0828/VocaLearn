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

  if (error) return <p className="text-sm text-red-500">{error}</p>;
  if (!stats)
    return (
      <div className="flex justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </div>
    );

  const masteredPct =
    stats.totalWords > 0
      ? Math.round((stats.mastered / stats.totalWords) * 100)
      : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-xl font-bold">學習進度</h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="連續天數" value={`🔥 ${stats.streak}`} />
        <Metric label="正確率" value={`${stats.accuracy}%`} />
        <Metric label="總作答" value={stats.attempts} />
        <Metric label="答對" value={stats.correct} />
      </div>

      {/* Mastery progress bar */}
      <div className="card p-5">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold">精熟進度</h2>
          <span className="text-sm text-slate-500">
            {stats.mastered} / {stats.totalWords}（{masteredPct}%）
          </span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-700 transition-all"
            style={{ width: `${masteredPct}%` }}
          />
        </div>
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
          已接觸 {stats.seen} 個單字，其中 {stats.mastered} 個達到精熟（連續答對 3
          次）。
        </p>
      </div>

      {/* Activity heatmap */}
      <div className="card p-5">
        <h2 className="mb-3 font-semibold">近期練習</h2>
        <Heatmap activity={stats.activity} />
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="card p-4">
      <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}

// Renders a GitHub-style contribution grid for the last ~13 weeks.
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
          : "bg-brand-600 dark:bg-brand-500";

  return (
    <div className="overflow-x-auto">
      <div className="grid grid-flow-col grid-rows-7 gap-1">
        {days.map((d) => (
          <div
            key={d.day}
            title={`${d.day}：${d.count} 題`}
            className={`h-3.5 w-3.5 rounded-sm ${level(d.count)}`}
          />
        ))}
      </div>
      <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
        <span>少</span>
        <span className="h-3 w-3 rounded-sm bg-slate-100 dark:bg-slate-800" />
        <span className="h-3 w-3 rounded-sm bg-brand-200 dark:bg-brand-900" />
        <span className="h-3 w-3 rounded-sm bg-brand-400 dark:bg-brand-700" />
        <span className="h-3 w-3 rounded-sm bg-brand-600 dark:bg-brand-500" />
        <span>多</span>
      </div>
    </div>
  );
}
