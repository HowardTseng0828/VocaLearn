"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api, type PathLesson } from "@/lib/api";
import { useApp } from "@/lib/store";

// A unit is drawn as a forest trail that fills the space left on screen:
// lesson stops sit at fixed % positions along a winding dirt path, with trees
// planted on whichever side the trail is not passing.
const TRAIL_X = [50, 78, 56, 24, 44, 76, 62, 28, 40, 70];
const TREES = ["🌲", "🌳", "🌲", "🌲", "🌳", "🌲", "🌳", "🌲", "🌲", "🌳"];
const DECOR = ["🌼", "🍄", "🌿", "🪨", "🌷"];

function trailPoints(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    x: TRAIL_X[i % TRAIL_X.length],
    y: count === 1 ? 50 : 7 + (i * 86) / (count - 1),
  }));
}

// Smooth curve through the stops (Catmull-Rom converted to cubic Béziers).
function trailPath(points: { x: number; y: number }[]) {
  if (points.length === 0) return "";
  const head = points[0];
  let d = `M ${head.x} ${head.y - 7}`;
  const all = [{ x: head.x, y: head.y - 7 }, ...points, { x: points[points.length - 1].x, y: points[points.length - 1].y + 7 }];
  for (let i = 0; i < all.length - 1; i++) {
    const p0 = all[i - 1] ?? all[i];
    const p1 = all[i];
    const p2 = all[i + 1];
    const p3 = all[i + 2] ?? p2;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${p2.x} ${p2.y}`;
  }
  return d;
}

export default function LearningPathPage() {
  const { t, course } = useApp();
  const [lessons, setLessons] = useState<PathLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [unitChoice, setUnitChoice] = useState<number | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  useEffect(() => {
    api.learningPath().then((result) => setLessons(result.lessons)).finally(() => setLoading(false));
  }, []);

  const units = useMemo(() => {
    const grouped = new Map<number, PathLesson[]>();
    for (const lesson of lessons) grouped.set(lesson.unit, [...(grouped.get(lesson.unit) ?? []), lesson]);
    return Array.from(grouped.entries());
  }, [lessons]);

  const completedCount = lessons.filter((lesson) => lesson.completed).length;
  // Every chapter is open; "current" is just the first one not finished yet.
  const current = lessons.find((lesson) => !lesson.completed) ?? lessons[0];
  const difficulty = (lesson: PathLesson) => {
    const n = (lesson.unit - 1) * 10 + lesson.lesson;
    return n <= 10 ? { label: t("path.level.basic"), mode: "en2zh" } : n <= 20 ? { label: t("path.level.advanced"), mode: "zh2en" } : n <= 30 ? { label: t("path.level.challenge"), mode: "spell" } : { label: t("path.level.mastery"), mode: "cloze" };
  };

  const unitIndex = Math.max(0, units.findIndex(([unit]) => unit === (unitChoice ?? current?.unit)));
  const [unit, unitLessons] = units[unitIndex] ?? [0, [] as PathLesson[]];
  const selected =
    unitLessons.find((lesson) => lesson.key === selectedKey) ??
    unitLessons.find((lesson) => lesson.key === current?.key) ??
    unitLessons.find((lesson) => !lesson.completed) ??
    unitLessons[0];
  const points = trailPoints(unitLessons.length);
  const trail = trailPath(points);

  function goUnit(index: number) {
    setUnitChoice(units[index][0]);
    setSelectedKey(null);
  }

  return (
    <div className="mx-auto flex h-full max-w-xl flex-col gap-3 animate-fade-in">
      <div className="flex shrink-0 items-center gap-3">
        <button type="button" className="btn btn-ghost h-12 w-12 shrink-0 !p-0 text-2xl" disabled={unitIndex === 0 || loading} onClick={() => goUnit(unitIndex - 1)} aria-label={t("path.prevUnit")} title={t("path.prevUnit")}>‹</button>
        <div className="min-w-0 flex-1 text-center">
          <p className="truncate text-xs font-extrabold text-brand-600 dark:text-brand-300">
            {t("path.title")}{course ? ` · ${course.name}` : ""} · {t("path.chapters", { done: completedCount, total: lessons.length || "…" })}
          </p>
          <h1 className="truncate text-lg font-extrabold">
            {units.length ? t("path.unit", { n: unit }) : t("path.title")}
            {unitLessons[0] && <span className="ml-1.5 text-sm font-bold text-slate-400">· {difficulty(unitLessons[0]).label}</span>}
          </h1>
          <div className="mx-auto mt-1 h-2 max-w-[12rem] overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
            <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${lessons.length ? (completedCount / lessons.length) * 100 : 0}%` }} />
          </div>
        </div>
        <button type="button" className="btn btn-ghost h-12 w-12 shrink-0 !p-0 text-2xl" disabled={unitIndex >= units.length - 1 || loading} onClick={() => goUnit(unitIndex + 1)} aria-label={t("path.nextUnit")} title={t("path.nextUnit")}>›</button>
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" /></div>
      ) : units.length === 0 ? (
        <div className="card p-8 text-center font-bold text-slate-500">{t("path.empty")}</div>
      ) : (
        <>
          <section className="relative min-h-[22rem] flex-1 overflow-hidden rounded-3xl border-2 border-emerald-200 bg-gradient-to-b from-emerald-100 via-lime-50 to-emerald-100 dark:border-emerald-900/60 dark:from-emerald-950 dark:via-slate-900 dark:to-emerald-950">
            {/* Trees and ground cover on the side the trail is not using */}
            {points.map((point, i) => (
              <span
                key={`tree-${i}`}
                aria-hidden="true"
                className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 select-none text-3xl drop-shadow-sm sm:text-4xl"
                style={{ left: `${point.x > 50 ? 12 + (i % 3) * 4 : 88 - (i % 3) * 4}%`, top: `${point.y + (i % 2 ? 3 : -2)}%` }}
              >
                {TREES[i % TREES.length]}
              </span>
            ))}
            {points.slice(0, -1).map((point, i) => (
              <span
                key={`decor-${i}`}
                aria-hidden="true"
                className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 select-none text-base opacity-80"
                style={{ left: `${point.x > 50 ? 30 : 70}%`, top: `${(point.y + points[i + 1].y) / 2}%` }}
              >
                {DECOR[i % DECOR.length]}
              </span>
            ))}

            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" fill="none" aria-hidden="true">
              <path d={trail} stroke="#a16207" strokeOpacity="0.35" strokeWidth="30" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              <path d={trail} stroke="#d6a35c" strokeWidth="22" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              <path d={trail} stroke="#f3dcb2" strokeWidth="3" strokeLinecap="round" strokeDasharray="2 12" vectorEffect="non-scaling-stroke" />
            </svg>

            {unitLessons.map((lesson, i) => {
              const point = points[i];
              const isCurrent = current?.key === lesson.key;
              const isSelected = selected?.key === lesson.key;
              return (
                <div
                  key={lesson.key}
                  className="absolute h-14 w-14 -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${point.x}%`, top: `${point.y}%` }}
                >
                  {isCurrent && !lesson.completed && <span className="absolute inset-0 animate-ping rounded-full bg-brand-400/50" />}
                  <button
                    type="button"
                    onClick={() => setSelectedKey(lesson.key)}
                    aria-label={`${lesson.key} · ${difficulty(lesson).label}`}
                    aria-pressed={isSelected}
                    className={`relative grid h-full w-full place-items-center rounded-full border-4 text-xl font-extrabold transition active:translate-y-0.5 ${
                      lesson.completed
                        ? "border-amber-300 bg-mode-gold text-white shadow-[0_5px_0_0_#d4a700]"
                        : isCurrent
                          ? "border-white bg-brand-500 text-white shadow-[0_5px_0_0_#46a302]"
                          : "border-white bg-white text-emerald-700 shadow-[0_5px_0_0_rgb(167_143_105)] dark:border-slate-600 dark:bg-slate-800 dark:text-emerald-300 dark:shadow-[0_5px_0_0_rgb(15_23_42)]"
                    } ${isSelected ? "scale-110 ring-4 ring-brand-300 dark:ring-brand-700" : ""}`}
                  >
                    {lesson.completed ? "★" : lesson.lesson}
                  </button>
                </div>
              );
            })}
          </section>

          {selected && (
            <div className="card flex shrink-0 items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-extrabold">{selected.key} · {difficulty(selected).label}</p>
                <p className="text-sm font-bold text-slate-400">
                  {t("path.practiced", { done: selected.practiced, total: selected.total })} · {t("path.masteredCount", { n: selected.mastered })}
                </p>
              </div>
              <Link href={`/practice?mode=${difficulty(selected).mode}&chapter=${selected.key}`} className={`btn shrink-0 !px-6 !py-4 text-base ${selected.completed ? "btn-blue" : "btn-primary"}`}>
                {selected.completed ? t("path.review") : t("path.start")}
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
