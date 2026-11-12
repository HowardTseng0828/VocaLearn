"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, type LeaderboardItem } from "@/lib/api";
import { useApp } from "@/lib/store";

export default function LeaderboardPage() {
  const { t, course } = useApp();
  const [items, setItems] = useState<LeaderboardItem[]>([]);
  const [me, setMe] = useState(0);
  const [visible, setVisible] = useState(true);
  useEffect(() => { api.leaderboard().then((result) => { setItems(result.items); setMe(result.currentUserId); setVisible(result.visible); }).catch(() => {}); }, []);
  return <div className="leaderboard-page mx-auto flex h-full max-w-3xl flex-col">
    <div className="mb-3 shrink-0 rounded-3xl bg-gradient-to-r from-amber-400 to-orange-500 p-4 text-white shadow-lg sm:mb-6 sm:p-6">
      <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{t("lb.title")}{course ? ` · ${course.name}` : ""}</h1>
      <p className="mt-1 text-sm font-bold text-amber-50 sm:mt-2 sm:text-base">{t("lb.rule")}</p>
    </div>
    {!visible && <p className="card mb-3 shrink-0 p-3 text-sm sm:mb-4 sm:p-4 font-bold text-slate-500 dark:text-slate-400">
      {t("lb.hidden")} <Link href="/profile" className="text-brand-600 dark:text-brand-300">{t("lb.enable")}</Link>
    </p>}
    <div className="card min-h-0 flex-1 overflow-y-auto overscroll-contain p-0 md:flex-none md:overflow-hidden">
      {items.length === 0 ? <p className="p-8 text-center font-bold text-slate-400">{t("lb.empty")}</p> : items.map((item) =>
        <div key={item.userId} className={`grid grid-cols-[40px_1fr_auto] items-center gap-3 border-b-2 border-slate-100 px-3 py-3 sm:grid-cols-[52px_1fr_auto] sm:px-5 sm:py-4 last:border-0 dark:border-slate-800 ${item.userId === me ? "bg-brand-50 dark:bg-brand-950/30" : ""}`}>
          <span className="text-center text-xl font-extrabold">{item.rank <= 3 ? ["🥇","🥈","🥉"][item.rank - 1] : item.rank}</span>
          <div><p className={`font-extrabold ${item.rank === 1 ? "text-amber-900 dark:text-amber-100" : "text-slate-900 dark:text-slate-100"}`}>{item.displayName || t("lb.anonymous")}{item.userId === me ? t("lb.me") : ""}</p><p className="text-xs font-bold text-slate-400">{t("lb.detail", { correct: item.correct, mastered: item.mastered })}</p></div>
          <span className="text-xl font-extrabold text-amber-500">{t("lb.score", { n: item.score })}</span>
        </div>)}
    </div>
  </div>;
}
