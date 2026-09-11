// Shared types for Cloudflare Pages Functions.

export interface Env {
  DB: D1Database;
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  AUTH_SECRET?: string;
  TURNSTILE_VERIFY_URL?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  FACEBOOK_CLIENT_ID?: string;
  FACEBOOK_CLIENT_SECRET?: string;
  RESEND_API_KEY?: string;
  RESET_EMAIL_FROM?: string;
  APP_BASE_URL?: string;
}

export interface UserRow {
  id: number;
  email: string;
  display_name: string;
  role: "admin" | "user";
}

export type QuizMode = "en2zh" | "zh2en" | "spell" | "cloze" | "speech";
