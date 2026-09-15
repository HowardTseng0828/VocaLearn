"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { api } from "@/lib/api";
import { useApp } from "@/lib/store";

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
  const { setUser, theme, toggleTheme } = useApp();
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
    if (authError) setError(authError);
    return () => { delete window.onVocaLearnTurnstile; };
  }, []);

  function resetChallenge() {
    setTurnstileToken("");
    window.turnstile?.reset();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    if (!turnstileToken) { setError("請先完成安全驗證"); return; }
    setBusy(true);
    try {
      if (mode === "forgot") {
        await api.forgotPassword(email, turnstileToken);
        setNotice("若此信箱已註冊，重設密碼信將在幾分鐘內送達。");
        resetChallenge();
        return;
      }
      const { user } =
        mode === "login"
          ? await api.login(email, password, turnstileToken)
          : await api.register(email, password, displayName, turnstileToken);
      setUser(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "發生錯誤");
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

      <button
        onClick={toggleTheme}
        className="btn btn-ghost absolute right-4 top-4 !px-3 !py-2"
        aria-label="切換深色模式"
      >
        {theme === "dark" ? "🌙" : "☀️"}
      </button>

      <div className="mb-7 text-center">
        <div className="mx-auto mb-3 grid h-20 w-20 animate-bounce-in place-items-center rounded-[28px] bg-brand-500 text-5xl shadow-[0_5px_0_0_#46a302]">
          🦉
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight">VocaLearn</h1>
        <p className="mt-1 text-sm font-bold text-slate-500 dark:text-slate-400">
          高中 7000 單字 · 每日練習
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
              {m === "login" ? "登入" : "註冊"}
            </button>
          ))}
        </div>

        {mode === "register" && (
          <div className="mb-3">
            <label className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-slate-400">
              暱稱（可選）
            </label>
            <input
              className="input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="你的名字"
              autoComplete="nickname"
            />
          </div>
        )}

        <div className="mb-3">
          <label className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-slate-400">
            電子郵件
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
            密碼
          </label>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === "register" ? "至少 8 個字元" : "密碼"}
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
        />

        {error && (
          <p className="mb-3 animate-wiggle rounded-xl bg-red-50 px-3 py-2.5 text-sm font-bold text-red-600 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        )}

        {notice && <p className="mb-3 rounded-xl bg-green-50 px-3 py-2.5 text-sm font-bold text-green-700 dark:bg-green-950/40 dark:text-green-300">{notice}</p>}

        <button className="btn btn-primary w-full" disabled={busy || !turnstileToken}>
          {busy ? "處理中…" : mode === "login" ? "登入" : mode === "register" ? "建立帳號" : "寄送重設信"}
        </button>

        {mode === "login" && <button type="button" onClick={() => { setMode("forgot"); setError(""); setNotice(""); resetChallenge(); }} className="mt-3 w-full text-sm font-extrabold text-brand-600">忘記密碼？</button>}
        {mode === "forgot" && <button type="button" onClick={() => { setMode("login"); setError(""); setNotice(""); resetChallenge(); }} className="mt-3 w-full text-sm font-extrabold text-brand-600">返回登入</button>}

        {mode !== "forgot" && <>
          <div className="my-5 flex items-center gap-3 text-xs font-bold text-slate-400"><span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />或使用<span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" /></div>
          <a href="/api/auth/oauth/google" className="btn btn-ghost w-full justify-center gap-3 border-2 border-slate-200 dark:border-slate-700">
            <GoogleIcon />
            使用 Google 登入
          </a>
        </>}
      </form>
    </div>
  );
}
