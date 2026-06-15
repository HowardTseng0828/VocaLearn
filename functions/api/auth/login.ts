import type { Env } from "../../_lib/types";
import { json, error, readJson } from "../../_lib/http";
import { verifyPassword, createSession, sessionCookie } from "../../_lib/auth";

interface Body {
  email?: string;
  password?: string;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const body = await readJson<Body>(request);
  const email = body?.email?.trim().toLowerCase();
  const password = body?.password ?? "";
  if (!email || !password) return error("請輸入電子郵件與密碼");

  const user = await env.DB.prepare(
    "SELECT id, password_hash, display_name FROM users WHERE email = ?"
  )
    .bind(email)
    .first<{ id: number; password_hash: string; display_name: string }>();

  // Same message whether the email or the password is wrong (avoid enumeration).
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return error("電子郵件或密碼錯誤", 401);
  }

  const token = await createSession(env, user.id);
  return json(
    { user: { id: user.id, email, displayName: user.display_name } },
    { headers: { "set-cookie": sessionCookie(token) } }
  );
};
