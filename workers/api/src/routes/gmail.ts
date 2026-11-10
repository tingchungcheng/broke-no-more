import { oauthConnections } from "@broke-no-more/database";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import {
  createGmailStart,
  exchangeGmailCode,
  GMAIL_SCOPE,
  openGmailState,
  readGmailAddress,
  revokeGoogleToken,
} from "../auth/gmail";
import { decodeEncryptionKey, openSeal, sealString } from "../auth/seal";
import type { AppEnv } from "../env";
import { gmailConnectConfigured } from "../env";
import { getEnv } from "../http/context";
import { clearCookie, GMAIL_COOKIE, readCookie, writeGmailCookie } from "../http/cookies";
import { appPath } from "../http/origin";
import { requireMutationCsrf, requireUser } from "../middleware/guards";

export const gmailRoutes = new Hono<AppEnv>();

gmailRoutes.use("*", requireUser);

gmailRoutes.get("/connect", async (c) => {
  const env = getEnv(c);
  if (!gmailConnectConfigured(env)) return c.redirect(appPath(env, "/settings/connections?error=gmail_not_configured"));
  const created = await createGmailStart(env);
  writeGmailCookie(c, created.token);
  return c.redirect(created.authorizationUrl);
});

gmailRoutes.get("/callback", async (c) => {
  const env = getEnv(c);
  const key = decodeEncryptionKey(env.TOKEN_ENCRYPTION_KEY);
  const finish = (code: string) => {
    clearCookie(c, GMAIL_COOKIE);
    return c.redirect(appPath(env, `/settings/connections?error=${code}`));
  };
  if (c.req.query("error") === "access_denied") return finish("gmail_denied");
  const code = c.req.query("code");
  const state = c.req.query("state");
  const cookie = readCookie(c, GMAIL_COOKIE);
  if (!code || !state || !cookie || !key || !gmailConnectConfigured(env)) return finish("gmail_auth_failed");

  try {
    const oauth = await openGmailState(cookie, env, state);
    const exchanged = await exchangeGmailCode(env, code, oauth.verifier);
    await readGmailAddress(exchanged.accessToken);
    const sealed = await sealString(key, exchanged.refreshToken);
    const now = new Date().toISOString();
    const db = env.db;
    const existing = await db
      .select({ id: oauthConnections.id })
      .from(oauthConnections)
      .where(and(eq(oauthConnections.userId, c.get("userId")), eq(oauthConnections.provider, "gmail")))
      .limit(1);
    const values = {
      status: "connected",
      scopes: GMAIL_SCOPE,
      encryptedRefreshToken: sealed,
      encryptionKeyVersion: "v1",
      tokenExpiresAt: null,
      connectedAt: now,
      disconnectedAt: null,
      updatedAt: now,
    };
    const current = existing[0];
    if (current) {
      await db.update(oauthConnections).set(values).where(eq(oauthConnections.id, current.id));
    } else {
      await db.insert(oauthConnections).values({
        id: crypto.randomUUID(),
        userId: c.get("userId"),
        provider: "gmail",
        createdAt: now,
        ...values,
      });
    }
    clearCookie(c, GMAIL_COOKIE);
    return c.redirect(appPath(env, "/settings/connections"));
  } catch {
    return finish("gmail_auth_failed");
  }
});

gmailRoutes.post("/disconnect", requireMutationCsrf, async (c) => {
  const env = getEnv(c);
  const key = decodeEncryptionKey(env.TOKEN_ENCRYPTION_KEY);
  const db = env.db;
  const rows = await db
    .select()
    .from(oauthConnections)
    .where(and(eq(oauthConnections.userId, c.get("userId")), eq(oauthConnections.provider, "gmail")))
    .limit(1);
  const current = rows[0];
  if (current?.encryptedRefreshToken && key) {
    try {
      const refreshToken = await openSeal(key, current.encryptedRefreshToken);
      await revokeGoogleToken(refreshToken);
    } catch {
      // The local row is still removed. A failed revoke must not keep the sealed token.
    }
  }
  if (current) {
    const now = new Date().toISOString();
    await db
      .update(oauthConnections)
      .set({
        status: "disconnected",
        encryptedRefreshToken: null,
        disconnectedAt: now,
        updatedAt: now,
      })
      .where(eq(oauthConnections.id, current.id));
  }
  return c.body(null, 204);
});
