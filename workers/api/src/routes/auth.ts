import { Hono } from "hono";
import { z } from "zod";
import { createCognitoStart, exchangeCognitoCode, verifyCognitoIdToken } from "../auth/cognito";
import { createOauthState, exchangeGoogleCode, openOauthState, verifyGoogleIdToken } from "../auth/google";
import { DEV_PERSONAS } from "../auth/personas";
import { createSession, deleteSessionById, sessionResponse, upsertIdentity } from "../auth/session";
import { cognitoAuthConfigured, gmailConnectConfigured, googleAuthConfigured, isDevAuthAllowed, type AppEnv } from "../env";
import { getEnv } from "../http/context";
import { clearCookie, OAUTH_COOKIE, readCookie, SESSION_COOKIE, writeOauthCookie, writeSessionCookie } from "../http/cookies";
import { ApiError } from "../http/errors";
import { readJson } from "../http/json";
import { appPath } from "../http/origin";
import { requireMutationCsrf, requireUser } from "../middleware/guards";

const devLoginSchema = z.object({ persona: z.enum(["alex", "blair"]) }).strict();

export const authRoutes = new Hono<AppEnv>();

authRoutes.get("/config", (c) => {
  const env = getEnv(c);
  return c.json({
    googleAuthEnabled: googleAuthConfigured(env),
    cognitoAuthEnabled: cognitoAuthConfigured(env),
    devAuthEnabled: isDevAuthAllowed(env),
    gmailConnectEnabled: gmailConnectConfigured(env),
  });
});

authRoutes.get("/google", async (c) => {
  const env = getEnv(c);
  if (!googleAuthConfigured(env)) {
    return c.redirect(appPath(env, "/login?error=google_not_configured"));
  }
  try {
    const created = await createOauthState(env);
    writeOauthCookie(c, created.token);
    return c.redirect(created.authorizationUrl);
  } catch {
    return c.redirect(appPath(env, "/login?error=google_not_configured"));
  }
});

authRoutes.get("/cognito", async (c) => {
  const env = getEnv(c);
  if (!cognitoAuthConfigured(env)) {
    return c.redirect(appPath(env, "/login?error=google_not_configured"));
  }
  try {
    const created = await createCognitoStart(env);
    writeOauthCookie(c, created.token);
    return c.redirect(created.authorizationUrl);
  } catch {
    return c.redirect(appPath(env, "/login?error=google_not_configured"));
  }
});

authRoutes.get("/google/callback", async (c) => {
  const env = getEnv(c);
  const fail = (code: "access_denied" | "google_auth_failed") => {
    clearCookie(c, OAUTH_COOKIE);
    return c.redirect(appPath(env, `/login?error=${code}`));
  };

  if (c.req.query("error")) {
    return fail(c.req.query("error") === "access_denied" ? "access_denied" : "google_auth_failed");
  }

  const code = c.req.query("code");
  const state = c.req.query("state");
  const cookie = readCookie(c, OAUTH_COOKIE);
  if (!code || !state || !cookie || !googleAuthConfigured(env)) return fail("google_auth_failed");

  try {
    const oauth = await openOauthState(cookie, env, state);
    const idToken = await exchangeGoogleCode(env, code, oauth.verifier);
    const identity = await verifyGoogleIdToken(idToken, env, oauth.nonce);
    const user = await upsertIdentity(env.db, identity);
    const session = await createSession(env.db, user.id);
    clearCookie(c, OAUTH_COOKIE);
    writeSessionCookie(c, session.token);
    return c.redirect(appPath(env, "/dashboard"));
  } catch {
    return fail("google_auth_failed");
  }
});

authRoutes.get("/cognito/callback", async (c) => {
  const env = getEnv(c);
  const fail = (code: "access_denied" | "google_auth_failed") => {
    clearCookie(c, OAUTH_COOKIE);
    return c.redirect(appPath(env, `/login?error=${code}`));
  };

  if (c.req.query("error")) {
    return fail(c.req.query("error") === "access_denied" ? "access_denied" : "google_auth_failed");
  }

  const code = c.req.query("code");
  const state = c.req.query("state");
  const cookie = readCookie(c, OAUTH_COOKIE);
  if (!code || !state || !cookie || !cognitoAuthConfigured(env)) return fail("google_auth_failed");

  try {
    const oauth = await openOauthState(cookie, env, state);
    const idToken = await exchangeCognitoCode(env, code, oauth.verifier);
    const identity = await verifyCognitoIdToken(idToken, env, oauth.nonce);
    const user = await upsertIdentity(env.db, identity);
    const session = await createSession(env.db, user.id);
    clearCookie(c, OAUTH_COOKIE);
    writeSessionCookie(c, session.token);
    return c.redirect(appPath(env, "/dashboard"));
  } catch {
    return fail("google_auth_failed");
  }
});

authRoutes.post("/dev-login", async (c) => {
  const env = getEnv(c);
  if (!isDevAuthAllowed(env)) throw new ApiError(404, "not_found", "Not found.");
  const body = await readJson(c, devLoginSchema);
  const db = env.db;
  const user = await upsertIdentity(db, DEV_PERSONAS[body.persona]);
  const session = await createSession(db, user.id);
  writeSessionCookie(c, session.token);
  c.header("cache-control", "no-store");
  return c.json(await sessionResponse(db, user.id, session.csrfToken));
});

authRoutes.use("/me", requireUser);
authRoutes.use("/logout", requireUser, requireMutationCsrf);

authRoutes.get("/me", async (c) => {
  c.header("cache-control", "no-store");
  return c.json(await sessionResponse(getEnv(c).db, c.get("userId"), c.get("csrfToken")));
});

authRoutes.post("/logout", async (c) => {
  await deleteSessionById(getEnv(c).db, c.get("sessionId"));
  clearCookie(c, SESSION_COOKIE);
  c.header("cache-control", "no-store");
  return c.body(null, 204);
});
