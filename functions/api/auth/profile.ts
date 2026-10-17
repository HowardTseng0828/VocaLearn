import type { Env } from "../../_lib/types";
import { getUser, getUserById, publicUser } from "../../_lib/auth";
import { error, json, readJson } from "../../_lib/http";
import { isValidTimeZone, normalizeLocale } from "../../_lib/i18n";
import { getLanguage } from "../../_lib/courses";

interface Body {
  displayName?: string;
  locale?: string;
  timezone?: string;
  targetLang?: string;
  leaderboardVisible?: boolean;
}

// PATCH /api/auth/profile — update the authenticated user's own settings.
// Every field is optional; only the fields present are changed.
export const onRequestPatch: PagesFunction<Env> = async ({ request, env }) => {
  const user = await getUser(request, env);
  if (!user) return error("UNAUTHORIZED", 401);

  const body = await readJson<Body>(request);
  if (!body) return error("BAD_REQUEST");
  const sets: string[] = [];
  const values: (string | number)[] = [];

  if (body.displayName !== undefined) {
    const displayName = body.displayName.trim();
    if (!displayName) return error("NAME_REQUIRED");
    if (displayName.length > 30) return error("NAME_TOO_LONG");
    sets.push("display_name = ?");
    values.push(displayName);
  }
  if (body.locale !== undefined) {
    const locale = normalizeLocale(body.locale);
    if (!locale) return error("BAD_REQUEST");
    sets.push("locale = ?");
    values.push(locale);
  }
  if (body.timezone !== undefined) {
    if (!isValidTimeZone(body.timezone)) return error("BAD_REQUEST");
    sets.push("timezone = ?");
    values.push(body.timezone);
  }
  if (body.targetLang !== undefined) {
    const language = await getLanguage(env, String(body.targetLang));
    if (!language || language.word_count === 0) return error("UNSUPPORTED_LANGUAGE");
    sets.push("target_lang = ?");
    values.push(language.code);
  }
  if (body.leaderboardVisible !== undefined) {
    sets.push("leaderboard_visible = ?");
    values.push(body.leaderboardVisible ? 1 : 0);
  }

  if (sets.length > 0) {
    await env.DB.prepare(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`)
      .bind(...values, user.id)
      .run();
  }

  const updated = await getUserById(env, user.id);
  return json({ user: updated && publicUser(updated) });
};
