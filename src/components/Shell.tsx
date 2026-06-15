"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApp } from "@/lib/store";
import { AuthScreen } from "./AuthScreen";
import { type ReactNode } from "react";

const NAV = [
  { href: "/", label: "首頁", icon: "🏠" },
  { href: "/practice", label: "練習", icon: "✏️" },
  { href: "/notebook", label: "錯題本", icon: "📕" },
  { href: "/stats", label: "進度", icon: "📊" },
  { href: "/words", label: "單字庫", icon: "📚" },
];

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
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  if (!user) return <AuthScreen />;

  return (
    <div className="min-h-screen pb-20 md:pb-0">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-white">
              V
            </span>
            <span className="text-lg font-bold tracking-tight">VocaLearn</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                    active
                      ? "bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200"
                      : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={logout}
              className="btn btn-ghost !px-3 !py-2 text-sm"
              title="登出"
            >
              登出
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>

      {/* Bottom nav (mobile) */}
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 md:hidden">
        <div className="mx-auto grid max-w-5xl grid-cols-5">
          {NAV.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-0.5 py-2.5 text-xs ${
                  active
                    ? "text-brand-600 dark:text-brand-300"
                    : "text-slate-500 dark:text-slate-400"
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
