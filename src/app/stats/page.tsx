"use client";

import { Fragment, useEffect, useState } from "react";
import { api, type Stats } from "@/lib/api";
import { useApp } from "@/lib/store";
import type { MessageKey } from "@/lib/i18n";

export default function StatsPage() {
  const { t, errorText, locale } = useApp();
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .stats()
      .then(setStats)
      .catch((e) => setError(errorText(e)));
  }, [errorText]);

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
    <div className="flex h-full flex-col gap-3 animate-fade-in sm:gap-6">
      <h1 className="page-title">{t("stats.title")}</h1>

      {/* 連續天數大卡 + 精熟進度環 */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        <div className="card flex items-center gap-2 p-3 sm:gap-4 sm:p-5">
          <span className="animate-flame text-3xl sm:text-5xl">🔥</span>
          <div>
            <div className="text-3xl font-extrabold text-mode-orange">
              {stats.streak}
            </div>
            <div className="stat-label">
              {t("stats.streak")}
            </div>
          </div>
        </div>

        <div className="card flex items-center gap-2 p-3 sm:gap-4 sm:p-5">
          <Ring pct={masteredPct} />
          <div>
            <div className="stat-label">
              {t("stats.mastery")}
            </div>
            <div className="text-xl font-extrabold">
              {stats.mastered}
              <span className="block text-sm font-bold text-slate-400 sm:inline">
                {" "}
                / {stats.totalWords}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 四格數據 */}
      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        <Metric icon="🎯" label={t("stats.accuracy")} value={`${stats.accuracy}%`} />
        <Metric icon="📝" label={t("stats.attempts")} value={stats.attempts} />
        <Metric icon="✅" label={t("stats.correct")} value={stats.correct} />
        <Metric icon="📖" label={t("stats.seen")} value={stats.seen} />
      </div>

      {/* 精熟進度條 */}
      <div className="card p-3 sm:p-5">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="section-title">{t("stats.mastery")}</h2>
          <span className="text-sm font-bold text-slate-500">
            {masteredPct}%
          </span>
        </div>
        <div className="progress-track shimmer">
          <div className="progress-fill" style={{ width: `${masteredPct}%` }} />
        </div>
        <p className="mt-2 text-sm font-medium text-slate-500 sm:mt-3 dark:text-slate-400">
          {t("stats.summary", { seen: stats.seen, mastered: stats.mastered })}
        </p>
      </div>

      {/* 活動熱力圖 */}
      <div className="card flex-1 p-4 sm:p-5">
        <h2 className="section-title mb-3">{t("stats.recent")}</h2>
        <Heatmap activity={stats.activity} today={stats.today} locale={locale} t={t} />
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
    <div className="relative h-12 w-12 shrink-0 sm:h-16 sm:w-16">
      <svg className="h-12 w-12 -rotate-90 sm:h-16 sm:w-16" viewBox="0 0 64 64">
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
      <span className="absolute inset-0 grid place-items-center text-xs font-extrabold sm:text-sm">
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
    <div className="card min-w-0 px-1 py-2.5 text-center sm:p-4 sm:text-left">
      <div className="stat-label flex flex-col items-center gap-0.5 sm:flex-row sm:gap-1.5">
        <span className="text-base">{icon}</span>
        <span className="max-w-full truncate">{label}</span>
      </div>
      <div className="mt-0.5 truncate text-2xl font-extrabold">{value}</div>
    </div>
  );
}

// GitHub 風格貢獻熱力圖（近 90 天）
// Days are YYYY-MM-DD keys in the learner's time zone, ending at the server's
// `today` so the grid matches how the streak is counted. Columns are weeks
// (Sunday first) so each row is a weekday; tapping a cell shows its date.
function Heatmap({
  activity,
  today,
  locale,
  t,
}: {
  activity: { day: string; answered: number; correct: number }[];
  today: string;
  locale: string;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
}) {
  const [picked, setPicked] = useState(today);
  const map = new Map(activity.map((a) => [a.day, a.answered]));
  const start = new Date(`${today}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - 90);
  // Pad the first week so rows line up with weekdays.
  const cells: ({ day: string; date: Date; count: number } | null)[] = Array(start.getUTCDay()).fill(null);
  const cursor = new Date(start);
  for (let i = 0; i <= 90; i++) {
    const key = cursor.toISOString().slice(0, 10);
    cells.push({ day: key, date: new Date(cursor), count: map.get(key) ?? 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  const weeks = Math.ceil(cells.length / 7);

  const monthFmt = new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" });
  const weekdayFmt = new Intl.DateTimeFormat(locale, { weekday: "narrow", timeZone: "UTC" });
  const dateFmt = new Intl.DateTimeFormat(locale, { month: "long", day: "numeric", weekday: "short", timeZone: "UTC" });
  // Label a week column when a month starts in it; the first column is
  // labelled too unless its month is about to end.
  const monthLabels = Array.from({ length: weeks }, (_, w) => {
    const week = cells.slice(w * 7, w * 7 + 7).filter((c) => c !== null);
    const first = week.find((c) => c.date.getUTCDate() === 1) ?? (w === 0 && week[0].date.getUTCDate() <= 14 ? week[0] : null);
    return first ? monthFmt.format(first.date) : "";
  });

  const level = (c: number) =>
    c === 0
      ? "bg-slate-100 dark:bg-slate-800"
      : c < 5
        ? "bg-brand-200 dark:bg-brand-900"
        : c < 15
          ? "bg-brand-400 dark:bg-brand-700"
          : "bg-brand-500 dark:bg-brand-500";

  const pickedCell = cells.find((c) => c?.day === picked);

  return (
    <div>
      <div
        className="grid max-w-md gap-1"
        style={{ gridTemplateColumns: `1.25rem repeat(${weeks}, minmax(0, 1fr))` }}
      >
        <span />
        {monthLabels.map((label, w) => (
          <span key={w} className="overflow-visible whitespace-nowrap text-xs font-bold text-slate-400">
            {label}
          </span>
        ))}
        {Array.from({ length: 7 }, (_, row) => (
          <Fragment key={row}>
            <span className="self-center text-xs font-bold text-slate-400">
              {row % 2 === 1 ? weekdayFmt.format(new Date(Date.UTC(2024, 0, 7 + row))) : ""}
            </span>
            {Array.from({ length: weeks }, (_, w) => {
              const cell = cells[w * 7 + row];
              if (!cell) return <span key={w} />;
              return (
                <button
                  key={w}
                  type="button"
                  onClick={() => setPicked(cell.day)}
                  title={t("stats.dayCount", { day: cell.day, n: cell.count })}
                  aria-label={t("stats.dayCount", { day: cell.day, n: cell.count })}
                  className={`aspect-square w-full rounded-[4px] ${level(cell.count)} ${
                    cell.day === picked ? "ring-2 ring-mode-orange ring-offset-1 ring-offset-white dark:ring-offset-slate-900" : ""
                  }`}
                />
              );
            })}
          </Fragment>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-extrabold">
          {pickedCell ? t("stats.dayCount", { day: dateFmt.format(pickedCell.date), n: pickedCell.count }) : ""}
        </p>
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400">
          <span>{t("stats.less")}</span>
          <span className="h-3 w-3 rounded-[4px] bg-slate-100 dark:bg-slate-800" />
          <span className="h-3 w-3 rounded-[4px] bg-brand-200 dark:bg-brand-900" />
          <span className="h-3 w-3 rounded-[4px] bg-brand-400 dark:bg-brand-700" />
          <span className="h-3 w-3 rounded-[4px] bg-brand-500" />
          <span>{t("stats.more")}</span>
        </div>
      </div>
    </div>
  );
}
