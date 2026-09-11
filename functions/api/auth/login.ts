import type { Env } from "../../_lib/types";
import { json, error, readJson } from "../../_lib/http";
import { verifyPassword, createSession, sessionCookie } from "../../_lib/auth";
import { verifyTurnstile } from "../../_lib/turnstile";

interface Body {
  email?: string;
  password?: string;
  turnstileToken?: string;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const body = await readJson<Body>(request);
  const email = body?.email?.trim().toLowerCase();
  const password = body?.password ?? "";
  if (!(await verifyTurnstile(env, body?.turnstileToken ?? "", request))) return error("安全驗證失敗，請重新驗證", 403);
  if (!email || !password) return error("請輸入電子郵件與密碼");

  const user = await env.DB.prepare(
    "SELECT id, password_hash, display_name, role FROM users WHERE email = ?"
  )
    .bind(email)
    .first<{ id: number; password_hash: string; display_name: string; role: "admin" | "user" }>();

  // Same message whether the email or the password is wrong (avoid enumeration).
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return error("電子郵件或密碼錯誤", 401);
  }

  const token = await createSession(env, user.id);
  return json(
    { user: { id: user.id, email, displayName: user.display_name, role: user.role } },
    { headers: { "set-cookie": sessionCookie(token) } }
  );
};
