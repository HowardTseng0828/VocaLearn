"use client";

import { useApp } from "@/lib/store";
import { LOCALES, type Locale } from "@/lib/i18n";

export function LocalePicker() {
  const { locale, setLocale, t } = useApp();
  return (
    <select
      value={locale}
      onChange={(e) => setLocale(e.target.value as Locale)}
      className="rounded-xl border-2 border-slate-200 bg-transparent px-2 py-1.5 text-xs font-extrabold dark:border-slate-700"
      aria-label={t("common.language")}
      title={t("common.language")}
    >
      {LOCALES.map((l) => (
        <option key={l.code} value={l.code}>{l.label}</option>
      ))}
    </select>
  );
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggleTheme, t } = useApp();
  return (
    <button
      onClick={toggleTheme}
      className={`btn btn-ghost !px-3 !py-2 ${className}`}
      aria-label={t("theme.toggle")}
      title={t("theme.toggle")}
    >
      {theme === "dark" ? "🌙" : "☀️"}
    </button>
  );
}
