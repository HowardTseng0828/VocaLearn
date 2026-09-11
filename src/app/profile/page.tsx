"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useApp } from "@/lib/store";

export default function ProfilePage() {
  const { user, setUser } = useApp();
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  if (!user) return null;

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const result = await api.updateProfile(displayName);
      setUser(result.user);
      setDisplayName(result.user.displayName);
      setMessage("名稱已更新");
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新失敗，請稍後再試");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl animate-fade-in">
      <div className="card p-6 sm:p-8">
        <h1 className="text-2xl font-extrabold">個人資料</h1>
        <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
          修改後會同步顯示在首頁與排行榜。
        </p>
        <form onSubmit={saveProfile} className="mt-6 space-y-4">
          <div>
            <label htmlFor="profile-email" className="mb-1 block text-sm font-extrabold text-slate-500 dark:text-slate-400">登入信箱</label>
            <input id="profile-email" className="input opacity-70" value={user.email} readOnly />
          </div>
          <div>
            <label htmlFor="profile-name" className="mb-1 block text-sm font-extrabold text-slate-500 dark:text-slate-400">顯示名稱</label>
            <input
              id="profile-name"
              className="input"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              maxLength={30}
              autoComplete="nickname"
              required
            />
          </div>
          <button type="submit" className="btn btn-primary w-full" disabled={busy || !displayName.trim()}>
            {busy ? "儲存中…" : "儲存名稱"}
          </button>
          {message && <p className="text-sm font-bold text-brand-600 dark:text-brand-300">{message}</p>}
          {error && <p className="text-sm font-bold text-red-500">{error}</p>}
        </form>
      </div>
    </div>
  );
}
