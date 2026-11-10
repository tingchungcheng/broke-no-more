import { createRemoteJWKSet, jwtVerify } from "jose";
import type { GoogleIdentity } from "./claims";
import { bytesToBase64Url, signValue } from "./crypto";
import type { OauthState } from "./google";
import type { Env } from "../env";
import { cognitoAuthConfigured, sessionSecret } from "../env";
import { appPath } from "../http/origin";

export function cognitoRegion(env: Env): string {
  return env.COGNITO_REGION || "ap-southeast-1";
}

export function cognitoIssuer(env: Env): string {
  return `https://cognito-idp.${cognitoRegion(env)}.amazonaws.com/${env.COGNITO_USER_POOL_ID}`;
}

export function cognitoRedirectUri(env: Env): string {
  return appPath(env, "/api/v1/auth/cognito/callback");
}

export async function createCognitoStart(env: Env): Promise<{ token: string; authorizationUrl: string }> {
  if (!cognitoAuthConfigured(env)) throw new Error("Cognito is not configured.");
  const state = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(24)));
  const verifier = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  const nonce = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(24)));
  const payload: OauthState = { state, verifier, nonce, exp: Date.now() + 10 * 60 * 1000 };
  const challengeBytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  const url = new URL(`https://${env.COGNITO_DOMAIN}/oauth2/authorize`);
  url.searchParams.set("client_id", env.COGNITO_CLIENT_ID ?? "");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("redirect_uri", cognitoRedirectUri(env));
  url.searchParams.set("state", state);
  url.searchParams.set("nonce", nonce);
  url.searchParams.set("code_challenge", bytesToBase64Url(new Uint8Array(challengeBytes)));
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("identity_provider", "Google");
  return { token: await signValue(payload, sessionSecret(env)), authorizationUrl: url.toString() };
}

export async function exchangeCognitoCode(env: Env, code: string, verifier: string): Promise<string> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: env.COGNITO_CLIENT_ID ?? "",
    code,
    redirect_uri: cognitoRedirectUri(env),
    code_verifier: verifier,
  });
  if (env.COGNITO_CLIENT_SECRET) body.set("client_secret", env.COGNITO_CLIENT_SECRET);
  const response = await fetch(`https://${env.COGNITO_DOMAIN}/oauth2/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const payload = (await response.json().catch(() => null)) as { id_token?: unknown } | null;
  if (!response.ok || !payload || typeof payload.id_token !== "string") {
    throw new Error("Cognito token exchange failed.");
  }
  return payload.id_token;
}

export async function verifyCognitoIdToken(idToken: string, env: Env, nonce: string): Promise<GoogleIdentity> {
  const issuer = cognitoIssuer(env);
  const jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
  const { payload } = await jwtVerify(idToken, jwks, {
    issuer,
    audience: env.COGNITO_CLIENT_ID,
  });
  if (payload.token_use !== "id") throw new Error("Cognito token is not an ID token.");
  if (typeof payload.nonce !== "string" || payload.nonce !== nonce) throw new Error("Cognito nonce did not match.");
  if (typeof payload.sub !== "string" || payload.sub.length === 0) throw new Error("Cognito token has no subject.");
  const emailVerified = payload.email_verified === true || payload.email_verified === "true";
  if (!emailVerified || typeof payload.email !== "string" || !payload.email.includes("@")) {
    throw new Error("A verified email is required.");
  }
  const name = typeof payload.name === "string" && payload.name.trim() ? payload.name.trim() : payload.email;
  const picture = typeof payload.picture === "string" && payload.picture.startsWith("https://") ? payload.picture : null;
  return { sub: `cognito:${payload.sub}`, email: payload.email, name, pictureUrl: picture };
}
