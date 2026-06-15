// Shared types for Cloudflare Pages Functions.

export interface Env {
  DB: D1Database;
  GEMINI_API_KEY?: string;
  AUTH_SECRET?: string;
}

export interface UserRow {
  id: number;
  email: string;
  display_name: string;
}

export type QuizMode = "en2zh" | "zh2en" | "spell" | "cloze";
