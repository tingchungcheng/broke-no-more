import { createRemoteJWKSet, jwtVerify } from "jose";
import { bytesToBase64Url, readSignedValue, signValue } from "./crypto";
import { assertGoogleIdentity, type GoogleIdentity } from "./claims";
import type { Env } from "../env";
import { sessionSecret } from "../env";
import { appPath } from "../http/origin";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";

export type OauthState = {
  state: string;
  verifier: string;
  nonce: string;
  exp: number;
};

export function googleRedirectUri(env: Env): string {
  return appPath(env, "/api/v1/auth/google/callback");
}

export async function createOauthState(env: Env): Promise<{ token: string; authorizationUrl: string }> {
  const state = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(24)));
  const verifier = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  const nonce = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(24)));
  const payload: OauthState = {
    state,
    verifier,
    nonce,
    exp: Date.now() + 10 * 60 * 1000,
  };
  const challengeBytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set("client_id", env.GOOGLE_CLIENT_ID ?? "");
  url.searchParams.set("redirect_uri", googleRedirectUri(env));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("nonce", nonce);
  url.searchParams.set("code_challenge", bytesToBase64Url(new Uint8Array(challengeBytes)));
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("prompt", "select_account");
  url.searchParams.set("include_granted_scopes", "false");
  return {
    token: await signValue(payload, sessionSecret(env)),
    authorizationUrl: url.toString(),
  };
}

export async function openOauthState(token: string, env: Env, state: string): Promise<OauthState> {
  const payload = await readSignedValue<OauthState>(token, sessionSecret(env));
  if (!payload.state || payload.state !== state || !payload.verifier || !payload.nonce || payload.exp < Date.now()) {
    throw new Error("OAuth state is invalid.");
  }
  return payload;
}

export async function exchangeGoogleCode(env: Env, code: string, verifier: string): Promise<string> {
  const body = new URLSearchParams({
    code,
    client_id: env.GOOGLE_CLIENT_ID ?? "",
    client_secret: env.GOOGLE_CLIENT_SECRET ?? "",
    redirect_uri: googleRedirectUri(env),
    grant_type: "authorization_code",
    code_verifier: verifier,
  });
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const payload = (await response.json().catch(() => null)) as { id_token?: unknown } | null;
  if (!response.ok || !payload || typeof payload.id_token !== "string") {
    throw new Error("Google token exchange failed.");
  }
  return payload.id_token;
}

export async function verifyGoogleIdToken(idToken: string, env: Env, nonce: string): Promise<GoogleIdentity> {
  const jwks = createRemoteJWKSet(new URL(GOOGLE_JWKS_URL));
  const { payload } = await jwtVerify(idToken, jwks, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: env.GOOGLE_CLIENT_ID,
  });
  return assertGoogleIdentity(payload, { clientId: env.GOOGLE_CLIENT_ID ?? "", nonce });
}
