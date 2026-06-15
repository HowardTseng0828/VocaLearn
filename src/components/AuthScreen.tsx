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
    <div className="relative flex min-h-screen flex-col items-center justify-center px-4">
      <button
        onClick={toggleTheme}
        className="btn btn-ghost absolute right-4 top-4 !px-3 !py-2"
        aria-label="切換深色模式"
      >
        {theme === "dark" ? "🌙" : "☀️"}
      </button>

      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-brand-600 text-2xl font-bold text-white">
          V
        </div>
        <h1 className="text-2xl font-bold">VocaLearn</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          高中 7000 單字 · 每日練習
        </p>
      </div>

      <form onSubmit={submit} className="card w-full max-w-sm p-6 animate-fade-in">
        <div className="mb-5 flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          {(["login", "register"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setError("");
              }}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
                mode === m
                  ? "bg-white text-brand-700 shadow-sm dark:bg-slate-700 dark:text-brand-200"
                  : "text-slate-500"
              }`}
            >
              {m === "login" ? "登入" : "註冊"}
            </button>
          ))}
        </div>

        {mode === "register" && (
          <div className="mb-3">
            <label className="mb-1 block text-sm font-medium">暱稱（可選）</label>
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
          <label className="mb-1 block text-sm font-medium">電子郵件</label>
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
          <label className="mb-1 block text-sm font-medium">密碼</label>
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
          <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-300">
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
