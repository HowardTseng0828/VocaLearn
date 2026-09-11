"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApp } from "@/lib/store";
import { AuthScreen } from "./AuthScreen";
import { type ReactNode } from "react";

const NAV = [
  { href: "/path", label: "學習歷程", icon: "path" },
  { href: "/", label: "首頁", icon: "🏠" },
  { href: "/practice", label: "練習", icon: "✏️" },
  { href: "/notebook", label: "錯題本", icon: "📕" },
  { href: "/stats", label: "進度", icon: "📊" },
  { href: "/leaderboard", label: "排行榜", icon: "🏆" },
  { href: "/words", label: "單字庫", icon: "📚" },
];

const PRIMARY_NAV = [
  { href: "/", label: "首頁", icon: "home" },
  { href: "/path", label: "學習歷程", icon: "path" },
  { href: "/practice", label: "練習", icon: "practice" },
  { href: "/notebook", label: "複習中心", icon: "review" },
  { href: "/stats", label: "進度", icon: "stats" },
];

function MenuIcon({ href }: { href: string }) {
  const path = href === "/" ? "M3 10.5 12 3l9 7.5M5.5 9v10h13V9M9 19v-5h6v5" :
    href === "/path" ? "M12 3v18M12 3l5 5M12 9l-5 5M12 15l5 5" :
    href === "/practice" ? "m4 19 4.5-1 9.8-9.8a2.1 2.1 0 0 0-3-3L5.5 15 4 19Zm10.2-12.8 3 3" :
    href === "/notebook" ? "M5 3h12a2 2 0 0 1 2 2v15H7a2 2 0 0 1-2-2V3Zm0 15a2 2 0 0 1 2-2h12M8 7h7M8 11h7" :
    href === "/stats" ? "M4 19V9m6 10V5m6 14V3m-13 16h14" :
    href === "/leaderboard" ? "M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Zm0 2H4v2a4 4 0 0 0 4 4m9-6h3v2a4 4 0 0 1-4 4" :
    "M4 5h16v14H4zM4 9h16M8 5v14";
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={path} /></svg>;
}

function ThemeToggle() {
  const { theme, toggleTheme } = useApp();
  return (
    <button
      onClick={toggleTheme}
      className="btn btn-ghost !px-3 !py-2"
      aria-label="切換深色模式"
      title="切換深色模式"
    >
      {theme === "dark" ? "🌙" : "☀️"}
    </button>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const { user, loading, logout } = useApp();
  const pathname = usePathname();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  if (!user && pathname === "/reset-password") return <>{children}</>;
  if (!user) return <AuthScreen />;

  return (
    <div className="min-h-screen pb-24 md:pb-0">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b-2 border-slate-100 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center overflow-hidden rounded-2xl bg-brand-500 text-[0px] shadow-[0_3px_0_0_#46a302]">
              <img src="/icon.svg" alt="VocaLearn" className="h-full w-full" />
              🦉
            </span>
            <span className="text-xl font-extrabold tracking-tight">
              VocaLearn
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden max-w-[52vw] items-center gap-1 overflow-x-auto md:flex">
            {PRIMARY_NAV.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-extrabold transition ${
                    active
                      ? "bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200"
                      : "text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                  }`}
                >
                  <MenuIcon href={item.href} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <Link href="/profile" className="hidden max-w-32 truncate text-sm font-extrabold text-slate-600 hover:text-brand-600 dark:text-slate-200 dark:hover:text-brand-300 sm:block" title="個人資料">
              {user.displayName || "個人資料"}
            </Link>
            <Link href="/profile" className="grid h-9 w-9 place-items-center rounded-xl text-lg hover:bg-slate-100 dark:hover:bg-slate-800 sm:hidden" aria-label="個人資料" title="個人資料">
              👤
            </Link>
            <ThemeToggle />
            <button
              onClick={logout}
              className="btn btn-ghost !px-3 !py-2 text-xs"
              title="登出"
            >
              登出
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>

      {/* Bottom nav (mobile) */}
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t-2 border-slate-100 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 md:hidden">
        <div className="mx-auto grid max-w-5xl grid-cols-5">
          {PRIMARY_NAV.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-bold"
              >
                <span
                  className={`grid h-9 w-12 place-items-center rounded-xl text-lg transition ${
                    active
                      ? "bg-brand-100 dark:bg-brand-900/40"
                      : "opacity-60"
                  }`}
                >
                  <MenuIcon href={item.href} />
                </span>
                <span
                  className={
                    active
                      ? "text-brand-600 dark:text-brand-300"
                      : "text-slate-400 dark:text-slate-500"
                  }
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
