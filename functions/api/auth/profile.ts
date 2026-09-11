import type { Env } from "../../_lib/types";
import { getUser } from "../../_lib/auth";
import { error, json, readJson } from "../../_lib/http";

interface Body {
  displayName?: string;
}

// PATCH /api/auth/profile — update only the authenticated user's display name.
export const onRequestPatch: PagesFunction<Env> = async ({ request, env }) => {
  const user = await getUser(request, env);
  if (!user) return error("未登入", 401);

  const body = await readJson<Body>(request);
  const displayName = body?.displayName?.trim() ?? "";
  if (!displayName) return error("請輸入名稱");
  if (displayName.length > 30) return error("名稱最多 30 個字");

  await env.DB.prepare("UPDATE users SET display_name = ? WHERE id = ?")
    .bind(displayName, user.id)
    .run();

  return json({
    user: { id: user.id, email: user.email, displayName },
  });
};
