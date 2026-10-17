import type { Env } from "../../_lib/types";
import { json, error, readJson, clientIp } from "../../_lib/http";
import { hashPassword, createSession, sessionCookie, getUserById, publicUser, MIN_PASSWORD_LENGTH } from "../../_lib/auth";
import { verifyTurnstile } from "../../_lib/turnstile";
import { rateLimit, HOUR } from "../../_lib/rate-limit";
import { DEFAULT_LOCALE, isValidTimeZone, localeFromCookie, normalizeLocale } from "../../_lib/i18n";

interface Body {
  email?: string;
  password?: string;
  displayName?: string;
  turnstileToken?: string;
  locale?: string;
  timezone?: string;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const body = await readJson<Body>(request);
  const email = body?.email?.trim().toLowerCase();
  const password = body?.password ?? "";
  const displayName = (body?.displayName?.trim() || email?.split("@")[0] || "").slice(0, 30);
  if (!(await rateLimit(env, `register:ip:${clientIp(request)}`, 10, HOUR))) return error("RATE_LIMITED", 429);
  if (!(await verifyTurnstile(env, body?.turnstileToken ?? "", request))) return error("TURNSTILE_FAILED", 403);

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return error("INVALID_EMAIL");
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return error("PASSWORD_TOO_SHORT");
  }

  const existing = await env.DB.prepare("SELECT id FROM users WHERE email = ?")
    .bind(email)
    .first();
  if (existing) return error("EMAIL_TAKEN", 409);

  const locale = normalizeLocale(body?.locale) ?? localeFromCookie(request) ?? DEFAULT_LOCALE;
  const timezone = isValidTimeZone(body?.timezone) ? body!.timezone! : "Asia/Taipei";
  const passwordHash = await hashPassword(password);
  // New accounts stay off the public leaderboard until the user opts in.
  const result = await env.DB.prepare(
    `INSERT INTO users (email, password_hash, display_name, created_at, locale, timezone, leaderboard_visible)
     VALUES (?, ?, ?, ?, ?, ?, 0)`
  )
    .bind(email, passwordHash, displayName, Date.now(), locale, timezone)
    .run();

  const userId = result.meta.last_row_id as number;
  const token = await createSession(env, userId);
  const user = await getUserById(env, userId);

  return json(
    { user: user && publicUser(user) },
    { headers: { "set-cookie": sessionCookie(token) } }
  );
};
