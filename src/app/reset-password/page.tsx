"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { useApp } from "@/lib/store";
import { LocalePicker } from "@/components/Controls";

export default function ResetPasswordPage() {
  const { t, errorText } = useApp();
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError("");
    if (password !== confirm) { setError(t("reset.mismatch")); return; }
    try { await api.resetPassword(token, password); setMessage(t("reset.done")); }
    catch (reason) { setError(errorText(reason)); }
  }
  return <div className="relative flex min-h-screen items-center justify-center px-4">
    <div className="absolute right-4 top-4"><LocalePicker /></div>
    <form onSubmit={submit} className="card w-full max-w-sm p-6">
      <h1 className="mb-1 text-2xl font-extrabold">{t("reset.title")}</h1>
      <p className="mb-5 text-sm font-bold text-slate-400">{t("reset.hint")}</p>
      <input className="input mb-3" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t("reset.new")} minLength={8} required />
      <input className="input mb-4" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={t("reset.confirm")} minLength={8} required />
      {error && <p className="mb-3 text-sm font-bold text-red-500">{error}</p>}
      {message && <p className="mb-3 text-sm font-bold text-green-600">{message}</p>}
      <button className="btn btn-primary w-full" disabled={!token || Boolean(message)}>{t("reset.submit")}</button>
      <Link href="/" className="mt-4 block text-center text-sm font-extrabold text-brand-600">{t("auth.backToLogin")}</Link>
    </form>
  </div>;
}
