import type { Env } from "../../_lib/types";
import { json, error, readJson } from "../../_lib/http";
import { hashPassword, sha256Hex, MIN_PASSWORD_LENGTH } from "../../_lib/auth";

interface Body { token?: string; password?: string }

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const body = await readJson<Body>(request);
  if (!body?.token || !body.password || body.password.length < MIN_PASSWORD_LENGTH) {
    return error(`重設連結無效，或密碼少於 ${MIN_PASSWORD_LENGTH} 個字元`);
  }
  const tokenHash = await sha256Hex(body.token);
  const row = await env.DB.prepare(
    "SELECT user_id FROM password_reset_tokens WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?"
  ).bind(tokenHash, Date.now()).first<{ user_id: number }>();
  if (!row) return error("重設連結已失效，請重新申請", 400);
  const now = Date.now();
  const passwordHash = await hashPassword(body.password);
  await env.DB.batch([
    env.DB.prepare("UPDATE users SET password_hash = ? WHERE id = ?").bind(passwordHash, row.user_id),
    env.DB.prepare("UPDATE password_reset_tokens SET used_at = ? WHERE token_hash = ?").bind(now, tokenHash),
    env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(row.user_id),
  ]);
  return json({ ok: true });
};
