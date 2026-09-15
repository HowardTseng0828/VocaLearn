import type { Env } from "../../_lib/types";
import { createSession, randomToken, sessionCookie } from "../../_lib/auth";
import { consumeOAuthState, providerConfig, type OAuthProvider } from "../../_lib/oauth";

interface Profile { id: string; email: string; name: string; picture?: string; emailVerified: boolean }

async function getProfile(provider: OAuthProvider, accessToken: string): Promise<Profile | null> {
  const endpoint = provider === "google"
    ? "https://openidconnect.googleapis.com/v1/userinfo"
    : `https://graph.facebook.com/me?fields=id,name,email,picture.type(large)&access_token=${encodeURIComponent(accessToken)}`;
  const response = await fetch(endpoint, provider === "google" ? { headers: { authorization: `Bearer ${accessToken}` } } : undefined);
  if (!response.ok) return null;
  const data = await response.json<Record<string, any>>();
  const id = provider === "google" ? data.sub : data.id;
  const picture = provider === "google" ? data.picture : data.picture?.data?.url;
  // Google reports email_verified explicitly. Facebook only returns the email
  // field once the address is confirmed, so its presence is the verification.
  const emailVerified = provider === "google" ? data.email_verified === true : Boolean(data.email);
  return id && data.email
    ? { id: String(id), email: String(data.email).toLowerCase(), name: String(data.name ?? ""), picture, emailVerified }
    : null;
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  const provider = url.searchParams.get("provider") as OAuthProvider;
  const code = url.searchParams.get("code") ?? "";
  const state = url.searchParams.get("state") ?? "";
  if ((provider !== "google" && provider !== "facebook") || !code || !(await consumeOAuthState(env, state, provider))) {
    return Response.redirect(`${url.origin}/?authError=${encodeURIComponent("社群登入驗證失敗")}`, 302);
  }
  const config = providerConfig(env, provider);
  if (!config.clientId || !config.clientSecret) return Response.redirect(`${url.origin}/?authError=${encodeURIComponent("社群登入尚未設定")}`, 302);
  const redirectUri = `${url.origin}/api/auth/oauth-callback?provider=${provider}`;
  const tokenUrl = provider === "google" ? "https://oauth2.googleapis.com/token" : "https://graph.facebook.com/oauth/access_token";
  const tokenResponse = await fetch(tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, code, redirect_uri: redirectUri, grant_type: "authorization_code" }),
  });
  if (!tokenResponse.ok) return Response.redirect(`${url.origin}/?authError=${encodeURIComponent("無法取得社群登入授權")}`, 302);
  const tokenData = await tokenResponse.json<{ access_token?: string }>();
  const profile = tokenData.access_token ? await getProfile(provider, tokenData.access_token) : null;
  if (!profile) return Response.redirect(`${url.origin}/?authError=${encodeURIComponent("社群帳號未提供電子郵件")}`, 302);

  let account = await env.DB.prepare(
    "SELECT u.id FROM oauth_accounts o JOIN users u ON u.id=o.user_id WHERE o.provider=? AND o.provider_user_id=?"
  ).bind(provider, profile.id).first<{ id: number }>();
  if (!account) {
    // Linking by email alone lets an unverified address take over an existing
    // password account, so only a verified address may be matched that way.
    account = profile.emailVerified
      ? await env.DB.prepare("SELECT id FROM users WHERE email=?").bind(profile.email).first<{ id: number }>()
      : null;
    if (!account) {
      const clash = await env.DB.prepare("SELECT id FROM users WHERE email=?").bind(profile.email).first<{ id: number }>();
      if (clash) {
        return Response.redirect(`${url.origin}/?authError=${encodeURIComponent("此電子郵件尚未通過社群帳號驗證，請改用密碼登入")}`, 302);
      }
      const created = await env.DB.prepare("INSERT INTO users (email,password_hash,display_name,created_at,avatar_url) VALUES (?,?,?,?,?)")
        .bind(profile.email, `oauth$${randomToken()}`, profile.name || profile.email.split("@")[0], Date.now(), profile.picture ?? null).run();
      account = { id: created.meta.last_row_id as number };
    }
    await env.DB.prepare("INSERT OR IGNORE INTO oauth_accounts (provider,provider_user_id,user_id,created_at) VALUES (?,?,?,?)")
      .bind(provider, profile.id, account.id, Date.now()).run();
  }
  const session = await createSession(env, account.id);
  return new Response(null, { status: 302, headers: { location: url.origin, "set-cookie": sessionCookie(session) } });
};
