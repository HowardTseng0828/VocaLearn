import type { Env } from "../../../_lib/types";
import { createOAuthState, providerConfig, type OAuthProvider } from "../../../_lib/oauth";

export const onRequestGet: PagesFunction<Env> = async ({ request, env, params }) => {
  const provider = String(params.provider) as OAuthProvider;
  if (provider !== "google" && provider !== "facebook") return new Response("不支援的登入方式", { status: 404 });
  const config = providerConfig(env, provider);
  if (!config.clientId || !config.clientSecret) return new Response("此登入方式尚未完成管理員設定", { status: 503 });
  const state = await createOAuthState(env, provider);
  const origin = new URL(request.url).origin;
  const redirectUri = `${origin}/api/auth/oauth-callback?provider=${provider}`;
  const url = provider === "google"
    ? new URL("https://accounts.google.com/o/oauth2/v2/auth")
    : new URL("https://www.facebook.com/dialog/oauth");
  url.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    state,
    scope: provider === "google" ? "openid email profile" : "email,public_profile",
  }).toString();
  return Response.redirect(url.toString(), 302);
};
