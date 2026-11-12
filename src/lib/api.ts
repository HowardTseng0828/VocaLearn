// Thin client-side fetch wrapper for the Pages Functions API.

import type { Locale } from "./i18n";

export interface User {
  id: number;
  email: string;
  displayName: string;
  role?: "admin" | "user";
  locale: Locale;
  timezone: string;
  targetLang: string;
  leaderboardVisible: boolean;
}

export interface Language {
  code: string;
  name: string;
  speechLocale: string;
  spaced: boolean;
  wordCount: number;
}

// Error carrying the API's machine-readable code (see functions/_lib/http.ts).
// Pages translate it with t(`error.${code}`).
export class ApiError extends Error {
  constructor(public code: string, public status: number) {
    super(code);
  }
}

declare global {
  interface Window {
    onVocaLearnTurnstile?: (token: string) => void;
    turnstile?: { reset: () => void };
  }
}

export type QuizMode = "en2zh" | "zh2en" | "spell" | "cloze" | "speech";

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.headers ?? {}),
    },
    credentials: "same-origin",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError((data as { error?: string }).error ?? "GENERIC", res.status);
  }
  return data as T;
}

export const api = {
  me: () => request<{ user: User | null; languages: Language[] }>("/auth/me"),
  learningPath: () => request<{ lessons: PathLesson[]; lessonSize: number; lessonsPerUnit: number }>("/path"),
  updateProfile: (changes: Partial<Pick<User, "displayName" | "locale" | "timezone" | "targetLang" | "leaderboardVisible">>) =>
    request<{ user: User }>("/auth/profile", {
      method: "PATCH",
      body: JSON.stringify(changes),
    }),
  deleteAccount: (confirmEmail: string) =>
    request<{ ok: true }>("/auth/account", {
      method: "DELETE",
      body: JSON.stringify({ confirmEmail }),
    }),
  register: (email: string, password: string, displayName: string, turnstileToken: string, locale: Locale) =>
    request<{ user: User }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, displayName, turnstileToken, locale, timezone: browserTimeZone() }),
    }),
  login: (email: string, password: string, turnstileToken: string) =>
    request<{ user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password, turnstileToken }),
    }),
  logout: () => request<{ ok: true }>("/auth/logout", { method: "POST" }),
  forgotPassword: (email: string, turnstileToken: string) => request<{ ok: true }>("/auth/forgot-password", {
    method: "POST", body: JSON.stringify({ email, turnstileToken }),
  }),
  resetPassword: (token: string, password: string) => request<{ ok: true }>("/auth/reset-password", {
    method: "POST", body: JSON.stringify({ token, password }),
  }),
  leaderboard: () => request<{ items: LeaderboardItem[]; currentUserId: number; visible: boolean }>("/leaderboard"),

  generateQuiz: (mode: string, count: number, review = false, chapter = "", reviewCorrect = false) =>
    request<{ quizId: string; questions: QuizQuestion[] }>(
      `/quiz/generate?mode=${mode}&count=${count}${review ? "&review=1" : ""}${reviewCorrect ? "&reviewCorrect=1" : ""}${chapter ? `&chapter=${encodeURIComponent(chapter)}` : ""}`
    ),
  chapterProgress: (chapter: string) => request<{ questionIndex: number }>(`/chapter-progress?chapter=${encodeURIComponent(chapter)}`),
  saveChapterProgress: (chapter: string, questionIndex: number, completed = false) =>
    request<{ ok: true }>("/chapter-progress", { method: "PUT", body: JSON.stringify({ chapter, questionIndex, completed }) }),
  // Only the first answer to an item is recorded; the server decides.
  answer: (quizId: string, position: number, answer: string) =>
    request<AnswerResult>("/quiz/answer", {
      method: "POST",
      body: JSON.stringify({ quizId, position, answer }),
    }),

  stats: () => request<Stats>("/stats"),
  wrongAnswers: (all = false) =>
    request<{ items: WrongAnswer[] }>(`/wrong-answers${all ? "?all=1" : ""}`),
  deleteWrong: (id: number) =>
    request<{ ok: true }>("/wrong-answers", {
      method: "POST",
      body: JSON.stringify({ id }),
    }),

  words: (q: string, page: number, size = 50, fresh = false) =>
    request<{ items: WordItem[]; total: number; page: number; size: number }>(
      `/words/list?q=${encodeURIComponent(q)}&page=${page}&size=${size}${fresh ? "&fresh=1" : ""}`
    ),
  importCsv: (csv: string, lang: string, locale?: Locale) =>
    request<{ parsed: number; imported: number; skipped: number; total: number }>(
      "/words/import",
      { method: "POST", body: JSON.stringify({ csv, lang, locale }) }
    ),

  aiExample: (quizId: string, position: number) =>
    request<AiCard>("/ai/example", {
      method: "POST",
      body: JSON.stringify({ quizId, position }),
    }),
};

export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Taipei";
  } catch {
    return "Asia/Taipei";
  }
}

export interface LeaderboardItem {
  userId: number;
  displayName: string;
  answered: number;
  correct: number;
  mastered: number;
  score: number;
  rank: number;
}

export interface PathLesson {
  key: string;
  unit: number;
  lesson: number;
  total: number;
  mastered: number;
  practiced: number;
  completed: boolean;
  unlocked: boolean;
}

// Fields depend on the mode; the answer to a typed question is never sent.
export interface QuizQuestion {
  position: number;
  mode: QuizMode;
  pos: string;
  word?: string;
  meaning?: string;
  choices?: string[];
  hint?: string;
  mask?: string;
}

export interface AnswerResult {
  correct: boolean;
  expected: string;
  word: string;
  meaning: string;
  mastered: boolean;
  recorded: boolean;
}

export interface Stats {
  totalWords: number;
  seen: number;
  mastered: number;
  attempts: number;
  correct: number;
  accuracy: number;
  openWrong: number;
  streak: number;
  today: string;
  activity: { day: string; answered: number; correct: number }[];
}

export interface WrongAnswer {
  id: number;
  mode: QuizMode;
  your_answer: string;
  created_at: number;
  resolved: number;
  word_id: number;
  word: string;
  pos: string;
  meaning: string;
}

export interface WordItem {
  id: number;
  word: string;
  pos: string;
  meaning: string;
  mastered: number;
  seen: number;
}

export interface AiCard {
  cloze: string;
  translation: string;
  source: "ai" | "mock" | "cache";
  synonyms: string[];
  antonyms: string[];
}
