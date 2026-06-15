"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useApp } from "@/lib/store";

export function AuthScreen() {
  const { setUser, theme, toggleTheme } = useApp();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const { user } =
        mode === "login"
          ? await api.login(email, password)
          : await api.register(email, password, displayName);
      setUser(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "發生錯誤");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4">
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

        <div className="mb-4">
          <label className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-slate-400">
            密碼
          </label>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="至少 6 個字元"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            required
          />
        </div>

        {error && (
          <p className="mb-3 animate-wiggle rounded-xl bg-red-50 px-3 py-2.5 text-sm font-bold text-red-600 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        )}

        <button className="btn btn-primary w-full" disabled={busy}>
          {busy ? "處理中…" : mode === "login" ? "登入" : "建立帳號"}
        </button>
      </form>
    </div>
  );
}
