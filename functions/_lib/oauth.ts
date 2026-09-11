import type { Env } from "./types";
import { randomToken } from "./auth";

export type OAuthProvider = "google" | "facebook";

export function providerConfig(env: Env, provider: OAuthProvider) {
  return provider === "google"
    ? { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET }
    : { clientId: env.FACEBOOK_CLIENT_ID, clientSecret: env.FACEBOOK_CLIENT_SECRET };
}

export async function createOAuthState(env: Env, provider: OAuthProvider): Promise<string> {
  const state = randomToken(24);
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM oauth_states WHERE expires_at < ?").bind(now),
    env.DB.prepare("INSERT INTO oauth_states (state, provider, created_at, expires_at) VALUES (?, ?, ?, ?)")
      .bind(state, provider, now, now + 10 * 60 * 1000),
  ]);
  return state;
}

export async function consumeOAuthState(env: Env, state: string, provider: OAuthProvider): Promise<boolean> {
  const row = await env.DB.prepare("SELECT state FROM oauth_states WHERE state = ? AND provider = ? AND expires_at > ?")
    .bind(state, provider, Date.now()).first();
  if (!row) return false;
  await env.DB.prepare("DELETE FROM oauth_states WHERE state = ?").bind(state).run();
  return true;
}
