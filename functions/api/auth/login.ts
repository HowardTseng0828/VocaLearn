import type { Env } from "../../_lib/types";
import { json, error, readJson, clientIp } from "../../_lib/http";
import { verifyPassword, createSession, sessionCookie, getUserById, publicUser } from "../../_lib/auth";
import { verifyTurnstile } from "../../_lib/turnstile";
import { rateLimit, MINUTE } from "../../_lib/rate-limit";

interface Body {
  email?: string;
  password?: string;
  turnstileToken?: string;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const body = await readJson<Body>(request);
  const email = body?.email?.trim().toLowerCase();
  const password = body?.password ?? "";
  if (!(await rateLimit(env, `login:ip:${clientIp(request)}`, 30, 10 * MINUTE))) return error("RATE_LIMITED", 429);
  if (!(await verifyTurnstile(env, body?.turnstileToken ?? "", request))) return error("TURNSTILE_FAILED", 403);
  if (!email || !password) return error("INVALID_CREDENTIALS");
  // Per-account limit so one address cannot be brute-forced from many IPs.
  if (!(await rateLimit(env, `login:email:${email}`, 10, 10 * MINUTE))) return error("RATE_LIMITED", 429);

  const user = await env.DB.prepare(
    "SELECT id, password_hash FROM users WHERE email = ?"
  )
    .bind(email)
    .first<{ id: number; password_hash: string }>();

  // Same error whether the email or the password is wrong (avoid enumeration).
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return error("INVALID_CREDENTIALS", 401);
  }

  const token = await createSession(env, user.id);
  const row = await getUserById(env, user.id);
  return json(
    { user: row && publicUser(row) },
    { headers: { "set-cookie": sessionCookie(token) } }
  );
};
