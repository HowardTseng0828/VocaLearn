"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api, type PathLesson } from "@/lib/api";

export default function LearningPathPage() {
  const [lessons, setLessons] = useState<PathLesson[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.learningPath().then((result) => setLessons(result.lessons)).finally(() => setLoading(false));
  }, []);

  const units = useMemo(() => {
    const grouped = new Map<number, PathLesson[]>();
    for (const lesson of lessons) grouped.set(lesson.unit, [...(grouped.get(lesson.unit) ?? []), lesson]);
    return Array.from(grouped.entries());
  }, [lessons]);

  const completedCount = lessons.filter((lesson) => lesson.completed).length;
  const current = lessons.find((lesson) => lesson.unlocked && !lesson.completed) ?? lessons[0];
  const difficulty = (lesson: PathLesson) => {
    const n = (lesson.unit - 1) * 10 + lesson.lesson;
    return n <= 10 ? { label: "基礎", mode: "en2zh" } : n <= 20 ? { label: "進階", mode: "zh2en" } : n <= 30 ? { label: "挑戰", mode: "spell" } : { label: "精熟", mode: "cloze" };
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-fade-in">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-400 via-brand-500 to-brand-600 p-6 text-white shadow-lg">
        <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/10" />
        <p className="text-sm font-bold opacity-90">學習歷程</p>
        <h1 className="mt-1 text-3xl font-extrabold">一步一步學會 7000 單字</h1>
        <p className="mt-2 max-w-xl text-sm font-medium opacity-90">完成每個章節後解鎖下一關，按照自己的速度累積精熟單字。</p>
        <div className="mt-5 flex items-center gap-3 text-sm font-extrabold">
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-white/25">
            <div className="h-full rounded-full bg-white transition-all" style={{ width: `${lessons.length ? (completedCount / lessons.length) * 100 : 0}%` }} />
          </div>
          <span>{completedCount} / {lessons.length || "…"} 章</span>
        </div>
      </section>

      {loading ? (
        <div className="flex justify-center py-16"><div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" /></div>
      ) : units.length === 0 ? (
        <div className="card p-8 text-center font-bold text-slate-500">目前還沒有可用的學習章節。</div>
      ) : (
        <div className="space-y-5">
          {units.map(([unit, unitLessons]) => (
            <section key={unit} className="card p-5 sm:p-6">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-wide text-brand-600 dark:text-brand-300">Unit {unit}</p>
                  <h2 className="text-xl font-extrabold">第 {unit} 單元</h2>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-extrabold text-slate-500 dark:bg-slate-800 dark:text-slate-300">每章 20 字</span>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                {unitLessons.map((lesson) => {
                  const level = difficulty(lesson);
                  const content = (
                    <>
                      <span className={`grid h-12 w-12 place-items-center rounded-full border-4 text-lg font-extrabold transition ${lesson.completed ? "border-brand-500 bg-brand-500 text-white" : lesson.unlocked ? "border-brand-300 bg-brand-50 text-brand-700 group-hover:scale-105 dark:border-brand-500 dark:bg-brand-950/40 dark:text-brand-200" : "border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-700 dark:bg-slate-800"}`}>
                        {lesson.completed ? "✓" : lesson.unlocked ? lesson.lesson : "—"}
                      </span>
                      <span className="text-sm font-extrabold">{lesson.key} · {level.label}</span>
                      <span className="text-[11px] font-bold text-slate-400">已完成 {lesson.practiced}/{lesson.total}</span>
                      <span className="text-[10px] font-bold text-slate-400">精熟 {lesson.mastered}</span>
                    </>
                  );
                  return lesson.unlocked ? (
                    <Link key={lesson.key} href={`/practice?mode=${level.mode}&chapter=${lesson.key}`} className={`group flex min-h-32 flex-col items-center justify-center gap-1 rounded-2xl border-2 p-3 text-center transition hover:-translate-y-0.5 ${current?.key === lesson.key ? "border-brand-400 bg-brand-50 dark:border-brand-500 dark:bg-brand-950/30" : "border-slate-100 dark:border-slate-800"}`}>
                      {content}
                    </Link>
                  ) : (
                    <div key={lesson.key} className="flex min-h-32 flex-col items-center justify-center gap-1 rounded-2xl border-2 border-slate-100 p-3 text-center opacity-60 dark:border-slate-800">
                      {content}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
