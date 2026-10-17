// Auth helpers: PBKDF2 password hashing + opaque cookie sessions.
// Uses only WebCrypto, which is available in the Cloudflare Workers runtime.

import type { Env, UserRow } from "./types";

// Minimum password length, shared by registration and password reset so the two
// flows cannot disagree (a 6-char password accepted at registration used to be
// rejected by the reset form).
export const MIN_PASSWORD_LENGTH = 8;

const SESSION_COOKIE = "vl_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const PBKDF2_ITERATIONS = 100_000;

const enc = new TextEncoder();

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return [...arr].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function randomToken(bytes = 32): string {
  return randomHex(bytes);
}

export async function sha256Hex(value: string): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", enc.encode(value)));
}

async function pbkdf2(password: string, saltHex: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const salt = Uint8Array.from(
    saltHex.match(/.{1,2}/g)!.map((h) => parseInt(h, 16))
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: PBKDF2_ITERATIONS },
    key,
    256
  );
  return toHex(bits);
}

// Stored format: pbkdf2$<saltHex>$<hashHex>
export async function hashPassword(password: string): Promise<string> {
  const salt = randomHex(16);
  const hash = await pbkdf2(password, salt);
  return `pbkdf2$${salt}$${hash}`;
}

export async function verifyPassword(
  password: string,
  stored: string
): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "pbkdf2") return false;
  const [, salt, expected] = parts;
  const actual = await pbkdf2(password, salt);
  // Constant-time-ish compare.
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) {
    diff |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

export async function createSession(env: Env, userId: number): Promise<string> {
  const token = randomHex(32);
  const now = Date.now();
  // Expired sessions are otherwise only removed when their cookie comes back.
  await env.DB.batch([
    env.DB.prepare("DELETE FROM sessions WHERE user_id = ? AND expires_at < ?").bind(userId, now),
    env.DB.prepare(
      "INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)"
    ).bind(token, userId, now, now + SESSION_TTL_MS),
  ]);
  return token;
}

export function sessionCookie(token: string): string {
  const maxAge = Math.floor(SESSION_TTL_MS / 1000);
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export function clearCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return null;
}

// Returns the authenticated user, or null. Also cleans up expired sessions lazily.
export async function getUser(
  request: Request,
  env: Env
): Promise<UserRow | null> {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return null;
  const row = await env.DB.prepare(
    `SELECT u.id, u.email, u.display_name, u.role, u.locale, u.timezone, u.target_lang,
            u.leaderboard_visible, s.expires_at
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token = ?`
  )
    .bind(token)
    .first<UserRow & { expires_at: number }>();
  if (!row) return null;
  if (row.expires_at < Date.now()) {
    await env.DB.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
    return null;
  }
  const { expires_at: _expiresAt, ...user } = row;
  return { ...user, role: isAdminEmail(env, user.email) ? "admin" : user.role };
}

export async function getUserById(env: Env, id: number): Promise<UserRow | null> {
  const row = await env.DB.prepare(
    `SELECT id, email, display_name, role, locale, timezone, target_lang, leaderboard_visible
       FROM users WHERE id = ?`
  ).bind(id).first<UserRow>();
  return row && { ...row, role: isAdminEmail(env, row.email) ? "admin" : row.role };
}

function isAdminEmail(env: Env, email: string): boolean {
  return (env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .includes(email.toLowerCase());
}

// The user shape returned to the client by every auth endpoint.
export function publicUser(user: UserRow) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    role: user.role,
    locale: user.locale,
    timezone: user.timezone,
    targetLang: user.target_lang,
    leaderboardVisible: user.leaderboard_visible === 1,
  };
}

export async function destroySession(request: Request, env: Env): Promise<void> {
  const token = readCookie(request, SESSION_COOKIE);
  if (token) {
    await env.DB.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
  }
}
