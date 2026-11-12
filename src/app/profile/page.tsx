"use client";

import { useState } from "react";
import { api, type User } from "@/lib/api";
import { LOCALES, type Locale } from "@/lib/i18n";
import { useApp } from "@/lib/store";

export default function ProfilePage() {
  const { user, setUser, logout, t, errorText, locale, setLocale, languages } = useApp();
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  if (!user) return null;

  async function save(changes: Parameters<typeof api.updateProfile>[0]) {
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const result = await api.updateProfile(changes);
      setUser(result.user);
      setMessage(t("profile.saved"));
      return result.user;
    } catch (err) {
      setError(errorText(err));
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function saveName(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const updated: User | null = await save({ displayName });
    if (updated) setDisplayName(updated.displayName);
  }

  async function deleteAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDeleting(true);
    setDeleteError("");
    try {
      await api.deleteAccount(confirmEmail);
      await logout();
    } catch (err) {
      setDeleteError(errorText(err));
    } finally {
      setDeleting(false);
    }
  }

  const label = "mb-1 block text-sm font-extrabold text-slate-500 dark:text-slate-400";

  return (
    <div className="mx-auto max-w-xl space-y-3 animate-fade-in sm:space-y-5">
      <div className="card p-4 sm:p-8">
        <div className="flex items-center justify-between gap-3">
          <h1 className="page-title">{t("profile.title")}</h1>
          <button type="button" onClick={logout} className="btn btn-ghost !px-3 !py-1.5 text-xs">{t("nav.logout")}</button>
        </div>
        <p className="mt-1 hidden text-sm sm:mt-2 sm:block font-medium text-slate-500 dark:text-slate-400">
          {t("profile.subtitle")}
        </p>
        <form onSubmit={saveName} className="mt-3 space-y-3 sm:mt-6 sm:space-y-4">
          <div>
            <label htmlFor="profile-email" className={label}>{t("profile.email")}</label>
            <input id="profile-email" className="input opacity-70" value={user.email} readOnly />
          </div>
          <div>
            <label htmlFor="profile-name" className={label}>{t("profile.name")}</label>
            <div className="flex gap-2">
              <input
                id="profile-name"
                className="input flex-1"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                maxLength={30}
                autoComplete="nickname"
                required
              />
              <button type="submit" className="btn btn-primary" disabled={busy || !displayName.trim()}>
                {busy ? t("profile.saving") : t("profile.save")}
              </button>
            </div>
          </div>
        </form>

        <div className="mt-3 grid grid-cols-2 gap-3 sm:mt-6 sm:gap-4">
          <div>
            <label htmlFor="profile-locale" className={label}>{t("profile.locale")}</label>
            <select
              id="profile-locale"
              className="input"
              value={locale}
              onChange={(event) => setLocale(event.target.value as Locale)}
            >
              {LOCALES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="profile-course" className={label}>{t("profile.course")}</label>
            <select
              id="profile-course"
              className="input"
              value={user.targetLang}
              disabled={busy}
              onChange={(event) => void save({ targetLang: event.target.value })}
            >
              {languages.map((l) => (
                <option key={l.code} value={l.code} disabled={l.wordCount === 0}>
                  {l.name} · {l.wordCount > 0 ? t("profile.wordCount", { n: l.wordCount.toLocaleString() }) : t("profile.noWords")}
                </option>
              ))}
            </select>
          </div>
          <p className="col-span-2 text-xs font-bold text-slate-400">
            {t("profile.timezone")}：{user.timezone}
          </p>
        </div>

        <label className="mt-3 flex cursor-pointer items-start gap-3 sm:mt-6">
          <input
            type="checkbox"
            className="mt-1 h-5 w-5 accent-brand-500"
            checked={user.leaderboardVisible}
            disabled={busy}
            onChange={(event) => void save({ leaderboardVisible: event.target.checked })}
          />
          <span>
            <span className="block text-sm font-extrabold">{t("profile.leaderboard")}</span>
            <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">{t("profile.leaderboardHint")}</span>
          </span>
        </label>

        {message && <p className="mt-4 text-sm font-bold text-brand-600 dark:text-brand-300">{message}</p>}
        {error && <p className="mt-4 text-sm font-bold text-red-500">{error}</p>}
      </div>

      <details className="card border-red-200 p-4 dark:border-red-900/50 sm:p-8">
        <summary className="cursor-pointer font-extrabold text-red-600 dark:text-red-400 sm:text-lg">{t("profile.deleteTitle")}</summary>
        <form onSubmit={deleteAccount}>
          <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">{t("profile.deleteHint")}</p>
          <input
            className="input mt-4"
            type="email"
            value={confirmEmail}
            onChange={(event) => setConfirmEmail(event.target.value)}
            placeholder={user.email}
            autoComplete="off"
          />
          <button
            type="submit"
            className="btn mt-3 w-full bg-red-600 text-white hover:bg-red-700"
            disabled={deleting || confirmEmail.trim().toLowerCase() !== user.email.toLowerCase()}
          >
            {deleting ? t("profile.deleting") : t("profile.deleteButton")}
          </button>
          {deleteError && <p className="mt-3 text-sm font-bold text-red-500">{deleteError}</p>}
        </form>
      </details>
    </div>
  );
}
