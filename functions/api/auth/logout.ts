import type { Env } from "../../_lib/types";
import { json } from "../../_lib/http";
import { destroySession, clearCookie } from "../../_lib/auth";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  await destroySession(request, env);
  return json({ ok: true }, { headers: { "set-cookie": clearCookie() } });
};
