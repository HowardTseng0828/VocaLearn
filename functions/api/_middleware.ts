import type { Env } from "../_lib/types";
import { json } from "../_lib/http";

// D1 may wrap the quota message in an Error.cause.
export function isDailyDatabaseLimit(error: unknown): boolean {
  const visited = new Set<unknown>();
  while (error instanceof Error && !visited.has(error)) {
    visited.add(error);
    if (/exceeded D1's free tier daily row (?:read|write) limit/i.test(error.message)) {
      return true;
    }
    error = error.cause;
  }
  return false;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  try {
    return await context.next();
  } catch (error) {
    if (!isDailyDatabaseLimit(error)) throw error;
    const now = new Date();
    const reset = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
    return json({ error: "DATABASE_DAILY_LIMIT" }, {
      status: 503,
      headers: {
        "retry-after": String(Math.max(1, Math.ceil((reset - now.getTime()) / 1000))),
        "cache-control": "no-store",
      },
    });
  }
};
