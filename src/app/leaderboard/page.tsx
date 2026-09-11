"use client";

import { useEffect, useState } from "react";
import { api, type LeaderboardItem } from "@/lib/api";

export default function LeaderboardPage() {
  const [items, setItems] = useState<LeaderboardItem[]>([]);
  const [me, setMe] = useState(0);
  useEffect(() => { api.leaderboard().then((result) => { setItems(result.items); setMe(result.currentUserId); }); }, []);
  return <div className="leaderboard-page mx-auto max-w-3xl">
    <div className="mb-6 rounded-3xl bg-gradient-to-r from-amber-400 to-orange-500 p-6 text-white shadow-lg">
      <h1 className="text-3xl font-extrabold">🏆 學習排行榜</h1>
      <p className="mt-2 font-bold text-amber-50">每題答對 1 分，每個精熟單字再加 10 分</p>
    </div>
    <div className="card overflow-hidden p-0">
      {items.length === 0 ? <p className="p-8 text-center font-bold text-slate-400">完成第一份練習後就會進入排行榜</p> : items.map((item) =>
        <div key={item.userId} className={`grid grid-cols-[52px_1fr_auto] items-center gap-3 border-b-2 border-slate-100 px-5 py-4 last:border-0 dark:border-slate-800 ${item.userId === me ? "bg-brand-50 dark:bg-brand-950/30" : ""}`}>
          <span className="text-center text-xl font-extrabold">{item.rank <= 3 ? ["🥇","🥈","🥉"][item.rank - 1] : item.rank}</span>
          <div><p className={`font-extrabold ${item.rank === 1 ? "text-amber-900 dark:text-amber-100" : "text-slate-900 dark:text-slate-100"}`}>{item.displayName || "匿名同學"}{item.userId === me ? "（我）" : ""}</p><p className="text-xs font-bold text-slate-400">答對 {item.correct} 題 · 精熟 {item.mastered} 字</p></div>
          <span className="text-xl font-extrabold text-amber-500">{item.score} 分</span>
        </div>)}
    </div>
  </div>;
}
