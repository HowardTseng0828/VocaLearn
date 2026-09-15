// Thin client-side fetch wrapper for the Pages Functions API.

export interface User {
  id: number;
  email: string;
  displayName: string;
  role?: "admin" | "user";
}

const POS_LABELS: Record<string, string> = {
  adj: "形容詞",
  a: "形容詞",
  adv: "副詞",
  n: "名詞",
  v: "動詞",
  prep: "介系詞",
  pron: "代名詞",
  conj: "連接詞",
  aux: "助動詞",
  phr: "片語",
};

/** Convert source abbreviations such as adj./n. into complete Chinese labels. */
export function formatPartOfSpeech(pos: string, meaning = ""): string {
  const tokens = pos.toLowerCase().split(/[\/、,，\s]+/).map((token) => token.replace(/\.$/, "")).filter(Boolean);
  if (/^\s*a\.?\s/i.test(meaning) && !tokens.includes("adj") && !tokens.includes("a")) tokens.push("adj");
  const labels = tokens.map((token) => POS_LABELS[token] ?? token).filter((label, index, all) => all.indexOf(label) === index);
  return labels.join("／");
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
    throw new Error((data as { error?: string }).error ?? "請求失敗");
  }
  return data as T;
}

export const api = {
  me: () => request<{ user: User | null }>("/auth/me"),
  learningPath: () => request<{ lessons: PathLesson[]; lessonSize: number; lessonsPerUnit: number }>("/path"),
  updateProfile: (displayName: string) =>
    request<{ user: User }>("/auth/profile", {
      method: "PATCH",
      body: JSON.stringify({ displayName }),
    }),
  register: (email: string, password: string, displayName: string, turnstileToken: string) =>
    request<{ user: User }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, displayName, turnstileToken }),
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
  leaderboard: () => request<{ items: LeaderboardItem[]; currentUserId: number }>("/leaderboard"),

  generateQuiz: (mode: string, count: number, review = false, chapter = "", reviewCorrect = false) =>
    request<{ questions: QuizQuestion[] }>(
      `/quiz/generate?mode=${mode}&count=${count}${review ? "&review=1" : ""}${reviewCorrect ? "&reviewCorrect=1" : ""}${chapter ? `&chapter=${encodeURIComponent(chapter)}` : ""}`
    ),
  chapterProgress: (chapter: string) => request<{ questionIndex: number }>(`/chapter-progress?chapter=${encodeURIComponent(chapter)}`),
  saveChapterProgress: (chapter: string, questionIndex: number, completed = false) =>
    request<{ ok: true }>("/chapter-progress", { method: "PUT", body: JSON.stringify({ chapter, questionIndex, completed }) }),
  // record=false grades the answer without writing progress — used by retries.
  answer: (wordId: number, mode: QuizMode, answer: string, record = true) =>
    request<AnswerResult>("/quiz/answer", {
      method: "POST",
      body: JSON.stringify({ wordId, mode, answer, record }),
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
  synonyms: string[];
  antonyms: string[];
  word: string;
  meaning: string;
}
