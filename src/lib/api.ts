// Thin client-side fetch wrapper for the Pages Functions API.

export interface User {
  id: number;
  email: string;
  displayName: string;
}

export type QuizMode = "en2zh" | "zh2en" | "spell" | "cloze";

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
    throw new Error((data as { error?: string }).error ?? "請求失敗");
  }
  return data as T;
}

export const api = {
  me: () => request<{ user: User | null }>("/auth/me"),
  register: (email: string, password: string, displayName: string) =>
    request<{ user: User }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, displayName }),
    }),
  login: (email: string, password: string) =>
    request<{ user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  logout: () => request<{ ok: true }>("/auth/logout", { method: "POST" }),

  generateQuiz: (mode: string, count: number, review = false) =>
    request<{ questions: QuizQuestion[] }>(
      `/quiz/generate?mode=${mode}&count=${count}${review ? "&review=1" : ""}`
    ),
  answer: (wordId: number, mode: QuizMode, answer: string) =>
    request<AnswerResult>("/quiz/answer", {
      method: "POST",
      body: JSON.stringify({ wordId, mode, answer }),
    }),

  stats: () => request<Stats>("/stats"),
  wrongAnswers: (all = false) =>
    request<{ items: WrongAnswer[] }>(`/wrong-answers${all ? "?all=1" : ""}`),
  deleteWrong: (id: number) =>
    request<{ ok: true }>("/wrong-answers", {
      method: "POST",
      body: JSON.stringify({ id }),
    }),

  words: (q: string, page: number, size = 50) =>
    request<{ items: WordItem[]; total: number; page: number; size: number }>(
      `/words/list?q=${encodeURIComponent(q)}&page=${page}&size=${size}`
    ),
  importCsv: (csv: string) =>
    request<{ parsed: number; imported: number; skipped: number; total: number }>(
      "/words/import",
      { method: "POST", body: JSON.stringify({ csv }) }
    ),

  aiExample: (wordId: number) =>
    request<AiCard>("/ai/example", {
      method: "POST",
      body: JSON.stringify({ wordId }),
    }),
};

export interface QuizQuestion {
  wordId: number;
  word: string;
  pos: string;
  meaning: string;
  mode: QuizMode;
  choices?: string[];
}

export interface AnswerResult {
  correct: boolean;
  expected: string;
  word: string;
  meaning: string;
  mastered: boolean;
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
  sentence: string;
  cloze: string;
  translation: string;
  source: "ai" | "mock";
  word: string;
  meaning: string;
}
