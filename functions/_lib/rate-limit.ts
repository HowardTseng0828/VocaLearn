// Fixed-window rate limiting backed by the rate_limits table.

import type { Env } from "./types";

const CLEANUP_AGE_MS = 24 * 60 * 60 * 1000;

// Counts one hit for `key` and returns false once the window holds more than
// `limit` hits. Old windows are pruned on roughly 1% of calls.
export async function rateLimit(env: Env, key: string, limit: number, windowMs: number): Promise<boolean> {
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const row = await env.DB.prepare(
    `INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1)
     ON CONFLICT(key, window_start) DO UPDATE SET count = count + 1
     RETURNING count`
  ).bind(key, windowStart).first<{ count: number }>();
  if (Math.random() < 0.01) {
    await env.DB.prepare("DELETE FROM rate_limits WHERE window_start < ?").bind(now - CLEANUP_AGE_MS).run();
  }
  return (row?.count ?? 0) <= limit;
}

export const MINUTE = 60 * 1000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;
