import type { Env, Locale } from "../../_lib/types";
import { json, error, readJson, clientIp } from "../../_lib/http";
import { randomToken, sha256Hex } from "../../_lib/auth";
import { verifyTurnstile } from "../../_lib/turnstile";
import { rateLimit, HOUR } from "../../_lib/rate-limit";
import { resetEmail } from "../../_lib/i18n";

interface Body { email?: string; turnstileToken?: string }

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const body = await readJson<Body>(request);
  if (!env.RESEND_API_KEY || !env.RESET_EMAIL_FROM || !env.APP_BASE_URL) {
    return error("RESET_NOT_CONFIGURED", 503);
  }
  if (!(await rateLimit(env, `forgot:ip:${clientIp(request)}`, 10, HOUR))) return error("RATE_LIMITED", 429);
  if (!(await verifyTurnstile(env, body?.turnstileToken ?? "", request))) return error("TURNSTILE_FAILED", 403);
  const email = body?.email?.trim().toLowerCase() ?? "";
  // Limit per address too, so nobody can flood one inbox. Respond with ok so
  // the limit does not reveal whether the address is registered.
  if (!(await rateLimit(env, `forgot:email:${email}`, 3, HOUR))) return json({ ok: true });
  const user = await env.DB.prepare("SELECT id, locale FROM users WHERE email = ?").bind(email).first<{ id: number; locale: Locale }>();
  if (!user) return json({ ok: true });

  const token = randomToken();
  const tokenHash = await sha256Hex(token);
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM password_reset_tokens WHERE user_id = ? OR expires_at < ?").bind(user.id, now),
    env.DB.prepare("INSERT INTO password_reset_tokens (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)")
      .bind(tokenHash, user.id, now, now + 30 * 60 * 1000),
  ]);

  const resetUrl = `${env.APP_BASE_URL.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(token)}`;
  const message = resetEmail(user.locale, resetUrl);
  const sent = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: env.RESET_EMAIL_FROM,
      to: [email],
      subject: message.subject,
      html: message.html,
    }),
  });
  if (!sent.ok) console.error("Password reset email delivery failed", sent.status);
  return json({ ok: true });
};
