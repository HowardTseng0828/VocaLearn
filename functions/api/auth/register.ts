import type { Env } from "../../_lib/types";
import { json, error, readJson } from "../../_lib/http";
import { hashPassword, createSession, sessionCookie } from "../../_lib/auth";
import { verifyTurnstile } from "../../_lib/turnstile";

interface Body {
  email?: string;
  password?: string;
  displayName?: string;
  turnstileToken?: string;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const body = await readJson<Body>(request);
  const email = body?.email?.trim().toLowerCase();
  const password = body?.password ?? "";
  const displayName = body?.displayName?.trim() || email?.split("@")[0] || "";
  if (!(await verifyTurnstile(env, body?.turnstileToken ?? "", request))) return error("安全驗證失敗，請重新驗證", 403);

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return error("請輸入有效的電子郵件");
  }
  if (password.length < 6) {
    return error("密碼至少需 6 個字元");
  }

  const existing = await env.DB.prepare("SELECT id FROM users WHERE email = ?")
    .bind(email)
    .first();
  if (existing) return error("此電子郵件已被註冊", 409);

  const passwordHash = await hashPassword(password);
  const now = Date.now();
  const result = await env.DB.prepare(
    "INSERT INTO users (email, password_hash, display_name, created_at) VALUES (?, ?, ?, ?)"
  )
    .bind(email, passwordHash, displayName, now)
    .run();

  const userId = result.meta.last_row_id as number;
  const token = await createSession(env, userId);

  return json(
    { user: { id: userId, email, displayName, role: "user" } },
    { headers: { "set-cookie": sessionCookie(token) } }
  );
};
