// Server-side locale helpers. UI strings live in the client (src/lib/i18n);
// the server only needs locales for meanings, AI prompts, and emails.

import type { Locale } from "./types";

export const LOCALES: Locale[] = ["zh-Hant", "en", "ja"];
export const DEFAULT_LOCALE: Locale = "zh-Hant";

export function normalizeLocale(value: unknown): Locale | null {
  if (typeof value !== "string") return null;
  const lower = value.toLowerCase();
  if (lower.startsWith("zh")) return "zh-Hant";
  if (lower.startsWith("ja")) return "ja";
  if (lower.startsWith("en")) return "en";
  return null;
}

// Locale preference cookie written by the client before sign-in, so register
// and OAuth sign-up can store it.
export function localeFromCookie(request: Request): Locale | null {
  const match = /(?:^|;\s*)vl_locale=([^;]+)/.exec(request.headers.get("cookie") ?? "");
  return match ? normalizeLocale(decodeURIComponent(match[1])) : null;
}

// Language names as used in AI prompts.
export const LOCALE_PROMPT_NAME: Record<Locale, string> = {
  "zh-Hant": "Traditional Chinese as used in Taiwan",
  en: "English",
  ja: "Japanese",
};

export function isValidTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

const RESET_EMAIL: Record<Locale, { subject: string; body: (url: string) => string }> = {
  "zh-Hant": {
    subject: "VocaLearn 密碼重設",
    body: (url) => `<p>你申請了 VocaLearn 密碼重設。</p><p><a href="${url}">在 30 分鐘內設定新密碼</a></p><p>若不是你本人操作，請忽略此信。</p>`,
  },
  en: {
    subject: "Reset your VocaLearn password",
    body: (url) => `<p>You asked to reset your VocaLearn password.</p><p><a href="${url}">Set a new password within 30 minutes</a></p><p>If this was not you, ignore this email.</p>`,
  },
  ja: {
    subject: "VocaLearn パスワードの再設定",
    body: (url) => `<p>VocaLearn のパスワード再設定がリクエストされました。</p><p><a href="${url}">30 分以内に新しいパスワードを設定してください</a></p><p>心当たりがない場合は、このメールを無視してください。</p>`,
  },
};

export function resetEmail(locale: Locale, url: string): { subject: string; html: string } {
  const template = RESET_EMAIL[locale] ?? RESET_EMAIL[DEFAULT_LOCALE];
  return { subject: template.subject, html: template.body(url) };
}
