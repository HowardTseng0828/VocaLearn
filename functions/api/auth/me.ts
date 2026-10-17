import type { Env } from "../../_lib/types";
import { json } from "../../_lib/http";
import { getUser, publicUser } from "../../_lib/auth";
import { listLanguages, publicLanguage } from "../../_lib/courses";

// Returns the current user (or null) and the available courses so the client
// can hydrate auth state, locale, and course settings in one request.
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const user = await getUser(request, env);
  if (!user) return json({ user: null, languages: [] });
  const languages = await listLanguages(env);
  return json({ user: publicUser(user), languages: languages.map(publicLanguage) });
};
