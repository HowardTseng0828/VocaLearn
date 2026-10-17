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
  return <div className="leaderboard-page mx-auto max-w-3xl">
    <div className="mb-6 rounded-3xl bg-gradient-to-r from-amber-400 to-orange-500 p-6 text-white shadow-lg">
      <h1 className="text-3xl font-extrabold">{t("lb.title")}{course ? ` · ${course.name}` : ""}</h1>
      <p className="mt-2 font-bold text-amber-50">{t("lb.rule")}</p>
    </div>
    {!visible && <p className="card mb-4 p-4 text-sm font-bold text-slate-500 dark:text-slate-400">
      {t("lb.hidden")} <Link href="/profile" className="text-brand-600 dark:text-brand-300">{t("lb.enable")}</Link>
    </p>}
    <div className="card overflow-hidden p-0">
      {items.length === 0 ? <p className="p-8 text-center font-bold text-slate-400">{t("lb.empty")}</p> : items.map((item) =>
        <div key={item.userId} className={`grid grid-cols-[52px_1fr_auto] items-center gap-3 border-b-2 border-slate-100 px-5 py-4 last:border-0 dark:border-slate-800 ${item.userId === me ? "bg-brand-50 dark:bg-brand-950/30" : ""}`}>
          <span className="text-center text-xl font-extrabold">{item.rank <= 3 ? ["🥇","🥈","🥉"][item.rank - 1] : item.rank}</span>
          <div><p className={`font-extrabold ${item.rank === 1 ? "text-amber-900 dark:text-amber-100" : "text-slate-900 dark:text-slate-100"}`}>{item.displayName || t("lb.anonymous")}{item.userId === me ? t("lb.me") : ""}</p><p className="text-xs font-bold text-slate-400">{t("lb.detail", { correct: item.correct, mastered: item.mastered })}</p></div>
          <span className="text-xl font-extrabold text-amber-500">{t("lb.score", { n: item.score })}</span>
        </div>)}
    </div>
  </div>;
}
