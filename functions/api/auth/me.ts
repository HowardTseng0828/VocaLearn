import type { Env } from "../../_lib/types";
import { json } from "../../_lib/http";
import { getUser } from "../../_lib/auth";

// Returns the current user (or null) so the client can hydrate auth state.
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const user = await getUser(request, env);
  if (!user) return json({ user: null });
  return json({
    user: { id: user.id, email: user.email, displayName: user.display_name },
  });
};
