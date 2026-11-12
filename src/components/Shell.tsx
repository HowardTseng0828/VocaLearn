"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApp } from "@/lib/store";
import { AuthScreen } from "./AuthScreen";
import { type ReactNode } from "react";
import { LocalePicker, ThemeToggle } from "./Controls";

const PRIMARY_NAV = [
  { href: "/", label: "nav.home", icon: "home" },
  { href: "/path", label: "nav.path", icon: "path" },
  { href: "/practice", label: "nav.practice", icon: "practice" },
  { href: "/notebook", label: "nav.review", icon: "review" },
  { href: "/stats", label: "nav.stats", icon: "stats" },
] as const;

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

export function Shell({ children }: { children: ReactNode }) {
  const { user, loading, logout, t } = useApp();
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
    <div className="flex h-[100dvh] flex-col overflow-hidden md:block md:h-auto md:min-h-screen md:overflow-visible">
      {/* Top bar */}
      <header className="z-20 shrink-0 border-b-2 pt-[env(safe-area-inset-top)] md:sticky md:top-0 border-slate-100 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-2 md:py-3">
          <Link href="/" className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center overflow-hidden rounded-2xl md:h-9 md:w-9 bg-brand-500 text-[0px] shadow-[0_3px_0_0_#46a302]">
              <img src="/icon.svg" alt="VocaLearn" className="h-full w-full" />
              🦉
            </span>
            <span className="text-lg font-extrabold tracking-tight md:text-xl">
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
                  {t(item.label)}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <Link href="/profile" className="hidden max-w-32 truncate text-sm font-extrabold text-slate-600 hover:text-brand-600 dark:text-slate-200 dark:hover:text-brand-300 sm:block" title={t("nav.profile")}>
              {user.displayName || t("nav.profile")}
            </Link>
            <Link href="/profile" className="grid h-9 w-9 place-items-center rounded-xl text-lg hover:bg-slate-100 dark:hover:bg-slate-800 sm:hidden" aria-label={t("nav.profile")} title={t("nav.profile")}>
              👤
            </Link>
            <span className="hidden sm:block"><LocalePicker /></span>
            <ThemeToggle />
            <button
              onClick={logout}
              className="btn btn-ghost !hidden !px-3 !py-2 text-xs sm:!inline-flex"
              title={t("nav.logout")}
            >
              {t("nav.logout")}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto min-h-0 w-full max-w-lg flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-4 py-3 md:max-w-5xl md:overflow-visible md:py-6">{children}</main>

      {/* Bottom nav (mobile) */}
      <nav className="z-20 shrink-0 border-t-2 pb-[env(safe-area-inset-bottom)] border-slate-100 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 md:hidden">
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
                className="flex flex-col items-center gap-0.5 py-2 text-xs font-bold"
              >
                <span
                  className={`grid h-9 w-14 place-items-center rounded-xl text-lg transition ${
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
                  {t(item.label)}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
