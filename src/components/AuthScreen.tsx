"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { api } from "@/lib/api";
import { useApp } from "@/lib/store";
import { isMessageKey } from "@/lib/i18n";
import { LocalePicker, ThemeToggle } from "./Controls";

function GoogleIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 18 18">
      <path fill="#4285F4" d="M17.64 9.205c0-.638-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.797 2.715v2.258h2.909c1.702-1.567 2.684-3.876 2.684-6.613Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.468-.806 5.956-2.182l-2.909-2.258c-.806.54-1.835.859-3.047.859-2.344 0-4.328-1.585-5.037-3.714H.956v2.332A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.963 10.705A5.41 5.41 0 0 1 3.682 9c0-.592.102-1.168.281-1.705V4.963H.956A9 9 0 0 0 0 9c0 1.452.347 2.826.956 4.037l3.007-2.332Z" />
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.507.454 3.441 1.346l2.582-2.582C13.464.892 11.426 0 9 0A9 9 0 0 0 .956 4.963l3.007 2.332C4.672 5.166 6.656 3.58 9 3.58Z" />
    </svg>
  );
}

export function AuthScreen() {
  const { setUser, refreshUser, theme, locale, t, errorText } = useApp();
  const [mode, setMode] = useState<"login" | "register" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    window.onVocaLearnTurnstile = (token: string) => setTurnstileToken(token);
    const authError = new URLSearchParams(window.location.search).get("authError");
    const key = `error.${authError}`;
    if (authError) setError(t(isMessageKey(key) ? key : "error.GENERIC"));
    return () => { delete window.onVocaLearnTurnstile; };
    // Read the redirect error once, in the locale active at mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetChallenge() {
    setTurnstileToken("");
    window.turnstile?.reset();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    if (!turnstileToken) { setError(t("auth.turnstileRequired")); return; }
    setBusy(true);
    try {
      if (mode === "forgot") {
        await api.forgotPassword(email, turnstileToken);
        setNotice(t("auth.resetSent"));
        resetChallenge();
        return;
      }
      const { user } =
        mode === "login"
          ? await api.login(email, password, turnstileToken)
          : await api.register(email, password, displayName, turnstileToken, locale);
      setUser(user);
      // Also loads the course list for the new session.
      await refreshUser();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
      if (mode !== "forgot") resetChallenge();
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4">
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" />
      {/* 背景裝飾光暈 */}
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-brand-300/40 blur-3xl dark:bg-brand-800/30" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-mode-blue/20 blur-3xl" />

      <div className="absolute right-4 top-4 flex items-center gap-2">
        <LocalePicker />
        <ThemeToggle />
      </div>

      <div className="mb-7 text-center">
        <div className="mx-auto mb-3 grid h-20 w-20 animate-bounce-in place-items-center rounded-[28px] bg-brand-500 text-5xl shadow-[0_5px_0_0_#46a302]">
          🦉
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight">VocaLearn</h1>
        <p className="mt-1 text-sm font-bold text-slate-500 dark:text-slate-400">
          {t("app.tagline")}
        </p>
      </div>

      <form
        onSubmit={submit}
        className="card relative z-10 w-full max-w-sm p-6 animate-fade-in"
      >
        <div className="mb-5 flex rounded-2xl bg-slate-100 p-1.5 dark:bg-slate-800">
          {(["login", "register"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setError("");
                setNotice("");
                resetChallenge();
              }}
              className={`flex-1 rounded-xl py-2.5 text-sm font-extrabold transition ${
                mode === m
                  ? "bg-white text-brand-600 shadow-sm dark:bg-slate-700 dark:text-brand-300"
                  : "text-slate-400"
              }`}
            >
              {m === "login" ? t("auth.login") : t("auth.register")}
            </button>
          ))}
        </div>

        {mode === "register" && (
          <div className="mb-3">
            <label className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-slate-400">
              {t("auth.nickname")}
            </label>
            <input
              className="input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={t("auth.nicknamePlaceholder")}
              autoComplete="nickname"
            />
          </div>
        )}

        <div className="mb-3">
          <label className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-slate-400">
            {t("auth.email")}
          </label>
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
        </div>

        {mode !== "forgot" && <div className="mb-4">
          <label className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-slate-400">
            {t("auth.password")}
          </label>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === "register" ? t("auth.passwordNew") : t("auth.password")}
            minLength={mode === "register" ? 8 : undefined}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            required
          />
        </div>}

        <div
          className="cf-turnstile mb-4 min-h-[65px]"
          data-sitekey="0x4AAAAAAEwANRY_hmq4L_SC"
          data-action="turnstile-spin-v1"
          data-callback="onVocaLearnTurnstile"
          data-theme={theme}
          data-language={locale === "zh-Hant" ? "zh-tw" : locale}
        />

        {error && (
          <p className="mb-3 animate-wiggle rounded-xl bg-red-50 px-3 py-2.5 text-sm font-bold text-red-600 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        )}

        {notice && <p className="mb-3 rounded-xl bg-green-50 px-3 py-2.5 text-sm font-bold text-green-700 dark:bg-green-950/40 dark:text-green-300">{notice}</p>}

        <button className="btn btn-primary w-full" disabled={busy || !turnstileToken}>
          {busy ? t("auth.busy") : mode === "login" ? t("auth.login") : mode === "register" ? t("auth.createAccount") : t("auth.sendReset")}
        </button>

        {mode === "login" && <button type="button" onClick={() => { setMode("forgot"); setError(""); setNotice(""); resetChallenge(); }} className="mt-3 w-full text-sm font-extrabold text-brand-600">{t("auth.forgot")}</button>}
        {mode === "forgot" && <button type="button" onClick={() => { setMode("login"); setError(""); setNotice(""); resetChallenge(); }} className="mt-3 w-full text-sm font-extrabold text-brand-600">{t("auth.backToLogin")}</button>}

        {mode !== "forgot" && <>
          <div className="my-5 flex items-center gap-3 text-xs font-bold text-slate-400"><span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />{t("auth.or")}<span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" /></div>
          <a href="/api/auth/oauth/google" className="btn btn-ghost w-full justify-center gap-3 border-2 border-slate-200 dark:border-slate-700">
            <GoogleIcon />
            {t("auth.google")}
          </a>
        </>}
      </form>
    </div>
  );
}
