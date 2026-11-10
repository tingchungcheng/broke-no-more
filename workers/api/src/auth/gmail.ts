import { bytesToBase64Url } from "./crypto";
import type { OauthState } from "./google";
import { openOauthState } from "./google";
import type { Env } from "../env";
import { sessionSecret } from "../env";
import { appPath } from "../http/origin";
import { signValue } from "./crypto";

export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

export function gmailRedirectUri(env: Env): string {
  return appPath(env, "/api/v1/gmail/callback");
}

export async function createGmailStart(env: Env): Promise<{ token: string; authorizationUrl: string }> {
  const state = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(24)));
  const verifier = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  const nonce = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(24)));
  const payload: OauthState = { state, verifier, nonce, exp: Date.now() + 10 * 60 * 1000 };
  const challengeBytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set("client_id", env.GOOGLE_CLIENT_ID ?? "");
  url.searchParams.set("redirect_uri", gmailRedirectUri(env));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GMAIL_SCOPE);
  url.searchParams.set("state", state);
  url.searchParams.set("nonce", nonce);
  url.searchParams.set("code_challenge", bytesToBase64Url(new Uint8Array(challengeBytes)));
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "false");
  return { token: await signValue(payload, sessionSecret(env)), authorizationUrl: url.toString() };
}

export async function openGmailState(token: string, env: Env, state: string): Promise<OauthState> {
  return openOauthState(token, env, state);
}

export async function exchangeGmailCode(
  env: Env,
  code: string,
  verifier: string,
): Promise<{ refreshToken: string; accessToken: string }> {
  const body = new URLSearchParams({
    code,
    client_id: env.GOOGLE_CLIENT_ID ?? "",
    client_secret: env.GOOGLE_CLIENT_SECRET ?? "",
    redirect_uri: gmailRedirectUri(env),
    grant_type: "authorization_code",
    code_verifier: verifier,
  });
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const payload = (await response.json().catch(() => null)) as {
    refresh_token?: unknown;
    access_token?: unknown;
  } | null;
  if (
    !response.ok ||
    !payload ||
    typeof payload.refresh_token !== "string" ||
    typeof payload.access_token !== "string"
  ) {
    throw new Error("Gmail token exchange failed.");
  }
  return { refreshToken: payload.refresh_token, accessToken: payload.access_token };
}

export async function readGmailAddress(accessToken: string): Promise<string> {
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  const payload = (await response.json().catch(() => null)) as { emailAddress?: unknown } | null;
  if (!response.ok || !payload || typeof payload.emailAddress !== "string" || !payload.emailAddress.includes("@")) {
    throw new Error("Gmail profile could not be read.");
  }
  return payload.emailAddress;
}

export async function revokeGoogleToken(token: string): Promise<void> {
  await fetch("https://oauth2.googleapis.com/revoke", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token }),
  });
}
