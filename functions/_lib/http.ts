// Small HTTP helpers for JSON responses and request parsing.

export function json(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init.headers ?? {}),
    },
  });
}

// Machine-readable error codes. The client translates them (src/lib/i18n), so
// the API never returns user-facing text in a fixed language.
export type ErrorCode =
  | "UNAUTHORIZED"
  | "BAD_REQUEST"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "TURNSTILE_FAILED"
  | "INVALID_EMAIL"
  | "PASSWORD_TOO_SHORT"
  | "EMAIL_TAKEN"
  | "INVALID_CREDENTIALS"
  | "RESET_NOT_CONFIGURED"
  | "RESET_LINK_INVALID"
  | "NAME_REQUIRED"
  | "NAME_TOO_LONG"
  | "INVALID_CHAPTER"
  | "QUIZ_EXPIRED"
  | "CSV_EMPTY"
  | "CSV_NO_ROWS"
  | "ADMIN_ONLY"
  | "UNSUPPORTED_LANGUAGE"
  | "CONFIRM_MISMATCH";

export function error(code: ErrorCode, status = 400): Response {
  return json({ error: code }, { status });
}

export async function readJson<T = Record<string, unknown>>(
  request: Request
): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

export function clientIp(request: Request): string {
  return request.headers.get("CF-Connecting-IP") ?? "unknown";
}
