import type { Env } from "../../_lib/types";
import { json, error, readJson } from "../../_lib/http";
import { randomToken, sha256Hex } from "../../_lib/auth";
import { verifyTurnstile } from "../../_lib/turnstile";

interface Body { email?: string; turnstileToken?: string }

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const body = await readJson<Body>(request);
  if (!env.RESEND_API_KEY || !env.RESET_EMAIL_FROM || !env.APP_BASE_URL) {
    return error("忘記密碼寄信尚未完成管理員設定", 503);
  }
  if (!(await verifyTurnstile(env, body?.turnstileToken ?? "", request))) return error("安全驗證失敗，請重新驗證", 403);
  const email = body?.email?.trim().toLowerCase() ?? "";
  const user = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first<{ id: number }>();
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
  const sent = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: env.RESET_EMAIL_FROM,
      to: [email],
      subject: "VocaLearn 密碼重設",
      html: `<p>你申請了 VocaLearn 密碼重設。</p><p><a href="${resetUrl}">在 30 分鐘內設定新密碼</a></p><p>若不是你本人操作，請忽略此信。</p>`,
    }),
  });
  if (!sent.ok) console.error("Password reset email delivery failed", sent.status);
  return json({ ok: true });
};
