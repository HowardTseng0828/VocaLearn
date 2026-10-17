import type { Env } from "../../../_lib/types";
import { createOAuthState, providerConfig, type OAuthProvider } from "../../../_lib/oauth";

export const onRequestGet: PagesFunction<Env> = async ({ request, env, params }) => {
  const provider = String(params.provider) as OAuthProvider;
  if (provider !== "google" && provider !== "facebook") return Response.redirect(`${new URL(request.url).origin}/?authError=OAUTH_FAILED`, 302);
  const config = providerConfig(env, provider);
  if (!config.clientId || !config.clientSecret) return Response.redirect(`${new URL(request.url).origin}/?authError=OAUTH_NOT_CONFIGURED`, 302);
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
