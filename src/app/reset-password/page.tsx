"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";

export default function ResetPasswordPage() {
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError("");
    if (password !== confirm) { setError("兩次密碼不一致"); return; }
    try { await api.resetPassword(token, password); setMessage("密碼已更新，請返回登入。"); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "重設失敗"); }
  }
  return <div className="flex min-h-screen items-center justify-center px-4">
    <form onSubmit={submit} className="card w-full max-w-sm p-6">
      <h1 className="mb-1 text-2xl font-extrabold">🔐 設定新密碼</h1>
      <p className="mb-5 text-sm font-bold text-slate-400">密碼至少需要 8 個字元</p>
      <input className="input mb-3" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="新密碼" minLength={8} required />
      <input className="input mb-4" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="再次輸入新密碼" minLength={8} required />
      {error && <p className="mb-3 text-sm font-bold text-red-500">{error}</p>}
      {message && <p className="mb-3 text-sm font-bold text-green-600">{message}</p>}
      <button className="btn btn-primary w-full" disabled={!token || Boolean(message)}>更新密碼</button>
      <Link href="/" className="mt-4 block text-center text-sm font-extrabold text-brand-600">返回登入</Link>
    </form>
  </div>;
}
