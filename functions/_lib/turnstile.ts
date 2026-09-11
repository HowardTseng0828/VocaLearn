import type { Env } from "./types";

export async function verifyTurnstile(env: Env, token: string, request: Request): Promise<boolean> {
  if (!env.TURNSTILE_VERIFY_URL || !token) return false;
  try {
    const response = await fetch(env.TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, remoteip: request.headers.get("CF-Connecting-IP") ?? undefined }),
    });
    const result = await response.json<{ success?: boolean }>();
    return result.success === true;
  } catch {
    return false;
  }
}
