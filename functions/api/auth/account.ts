import type { Env } from "../../_lib/types";
import { clearCookie, getUser } from "../../_lib/auth";
import { error, json, readJson } from "../../_lib/http";

interface Body {
  confirmEmail?: string;
}

// DELETE /api/auth/account — permanently deletes the signed-in account.
// The user must type their email to confirm. Every per-user table references
// users(id) with ON DELETE CASCADE, so progress, sessions, notebook entries,
// stats and OAuth links go with it.
export const onRequestDelete: PagesFunction<Env> = async ({ request, env }) => {
  const user = await getUser(request, env);
  if (!user) return error("UNAUTHORIZED", 401);

  const body = await readJson<Body>(request);
  if (body?.confirmEmail?.trim().toLowerCase() !== user.email.toLowerCase()) {
    return error("CONFIRM_MISMATCH");
  }

  await env.DB.prepare("DELETE FROM users WHERE id = ?").bind(user.id).run();
  return json({ ok: true }, { headers: { "set-cookie": clearCookie() } });
};
