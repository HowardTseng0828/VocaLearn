"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api, ApiError, browserTimeZone, type Language, type User } from "./api";
import {
  detectLocale,
  isMessageKey,
  persistLocale,
  translate,
  type Locale,
  type MessageKey,
} from "./i18n";

interface AppState {
  user: User | null;
  loading: boolean;
  theme: "light" | "dark";
  toggleTheme: () => void;
  setUser: (u: User | null) => void;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
  // Translates an error thrown by the API client into the UI language.
  errorText: (err: unknown) => string;
  languages: Language[];
  // The user's current target-language course, if it exists.
  course: Language | null;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [locale, setLocaleState] = useState<Locale>("zh-Hant");

  // Restore theme and locale (fall back to system preference).
  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem("vl-theme");
    } catch {
      // Storage unavailable: use the system preference.
    }
    const initial =
      stored === "dark" || stored === "light"
        ? stored
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
    setTheme(initial);
    const detected = detectLocale();
    setLocaleState(detected);
    persistLocale(detected);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    try {
      localStorage.setItem("vl-theme", theme);
    } catch {
      // Not fatal.
    }
  }, [theme]);

  // A signed-in user's saved locale wins over the browser's.
  const setUser = useCallback((u: User | null) => {
    setUserState(u);
    if (u?.locale) {
      setLocaleState(u.locale);
      persistLocale(u.locale);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const { user, languages } = await api.me();
      setUser(user);
      setLanguages(languages);
      // Keep streak days in the user's current time zone.
      const timeZone = browserTimeZone();
      if (user && user.timezone !== timeZone) {
        api.updateProfile({ timezone: timeZone }).then((r) => setUserState(r.user)).catch(() => {});
      }
    } catch {
      setUser(null);
    }
  }, [setUser]);

  useEffect(() => {
    refreshUser().finally(() => setLoading(false));
  }, [refreshUser]);

  const logout = useCallback(async () => {
    await api.logout().catch(() => {});
    setUserState(null);
  }, []);

  const toggleTheme = useCallback(
    () => setTheme((t) => (t === "dark" ? "light" : "dark")),
    []
  );

  const setLocale = useCallback(
    (next: Locale) => {
      setLocaleState(next);
      persistLocale(next);
      if (user && user.locale !== next) {
        api.updateProfile({ locale: next }).then((r) => setUserState(r.user)).catch(() => {});
      }
    },
    [user]
  );

  const t = useCallback(
    (key: MessageKey, vars?: Record<string, string | number>) => translate(locale, key, vars),
    [locale]
  );

  const errorText = useCallback(
    (err: unknown) => {
      const key = err instanceof ApiError ? `error.${err.code}` : "";
      return translate(locale, isMessageKey(key) ? key : "error.GENERIC");
    },
    [locale]
  );

  const course = languages.find((l) => l.code === user?.targetLang) ?? null;

  return (
    <AppContext.Provider
      value={{
        user, loading, theme, toggleTheme, setUser, refreshUser, logout,
        locale, setLocale, t, errorText, languages, course,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
