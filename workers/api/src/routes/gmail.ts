import { oauthConnections, statements, syncJobs } from "@broke-no-more/database";
import { isoDateSchema, normalizeStatementKeywords, validateStatementScanRange } from "@broke-no-more/shared";
import { and, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import {
  createGmailStart,
  exchangeGmailCode,
  GMAIL_SCOPE,
  openGmailState,
  readGmailAddress,
  refreshGmailAccessToken,
  revokeGoogleToken,
} from "../auth/gmail";
import { decodeEncryptionKey, openSeal, sealString } from "../auth/seal";
import { scanStatementMessages } from "../gmail/scan";
import { readSavedStatements } from "../statements/read-saved";
import type { AppEnv } from "../env";
import { gmailConnectConfigured } from "../env";
import { getEnv } from "../http/context";
import { clearCookie, GMAIL_COOKIE, readCookie, writeGmailCookie } from "../http/cookies";
import { appPath } from "../http/origin";
import { ApiError } from "../http/errors";
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

const syncBody = z
  .object({
    keywords: z.array(z.string()).min(1).max(12),
    fromDate: isoDateSchema,
    toDate: isoDateSchema,
  })
  .strict();

gmailRoutes.post("/sync", requireMutationCsrf, async (c) => {
  const env = getEnv(c);
  const parsed = syncBody.safeParse(await c.req.json());
  if (!parsed.success) throw new ApiError(400, "validation_error", "Request is invalid.");
  const keywords = normalizeStatementKeywords(parsed.data.keywords);
  if (keywords.length === 0) throw new ApiError(400, "validation_error", "Add at least one plain keyword.");
  let range;
  try {
    range = validateStatementScanRange(parsed.data.fromDate, parsed.data.toDate);
  } catch (error) {
    throw new ApiError(400, "validation_error", error instanceof Error ? error.message : "Dates are invalid.");
  }
  const db = env.db;
  const userId = c.get("userId");
  const key = decodeEncryptionKey(env.TOKEN_ENCRYPTION_KEY);
  const connectionRows = await db
    .select()
    .from(oauthConnections)
    .where(and(eq(oauthConnections.userId, userId), eq(oauthConnections.provider, "gmail"), eq(oauthConnections.status, "connected")))
    .limit(1);
  const connection = connectionRows[0];
  if (!connection?.encryptedRefreshToken || !key) {
    throw new ApiError(409, "gmail_not_connected", "Connect Gmail before scanning for statements.");
  }

  const recent = await db
    .select({ startedAt: syncJobs.startedAt, status: syncJobs.status })
    .from(syncJobs)
    .where(and(eq(syncJobs.userId, userId), eq(syncJobs.kind, "gmail_statement_scan")))
    .orderBy(desc(syncJobs.startedAt))
    .limit(1);
  const startedAt = recent[0]?.startedAt ? Date.parse(recent[0].startedAt) : Number.NaN;
  if ((recent[0]?.status === "running" || recent[0]?.status === "succeeded") && Date.now() - startedAt < 15_000) {
    throw new ApiError(429, "sync_too_soon", "Wait a few seconds before scanning again.");
  }

  const now = new Date().toISOString();
  const jobId = crypto.randomUUID();
  await db.insert(syncJobs).values({
    id: jobId,
    userId,
    kind: "gmail_statement_scan",
    status: "running",
    retryCount: 0,
    startedAt: now,
    createdAt: now,
    updatedAt: now,
  });

  try {
    const refreshToken = await openSeal(key, connection.encryptedRefreshToken);
    const accessToken = await refreshGmailAccessToken(env, refreshToken);
    const scan = await scanStatementMessages(accessToken, keywords, range);
    let saved = 0;
    for (const found of scan.discovered) {
      const existing = await db
        .select({ id: statements.id })
        .from(statements)
        .where(and(eq(statements.userId, userId), eq(statements.gmailMessageId, found.gmailMessageId)))
        .limit(1);
      if (existing[0]) continue;
      const savedAt = new Date().toISOString();
      await db.insert(statements).values({
        id: crypto.randomUUID(),
        userId,
        source: "GMAIL",
        status: "DISCOVERED",
        checksum: `gmail:${found.gmailMessageId}`,
        gmailMessageId: found.gmailMessageId,
        subject: found.subject,
        sender: found.sender,
        receivedOn: found.receivedOn,
        matchedKeywords: found.matchedKeywords.join(", "),
        createdAt: savedAt,
        updatedAt: savedAt,
      });
      saved += 1;
    }
    const finishedAt = new Date().toISOString();
    await db
      .update(syncJobs)
      .set({ status: "succeeded", finishedAt, updatedAt: finishedAt, checkpoint: String(scan.inspected) })
      .where(eq(syncJobs.id, jobId));
    return c.json({ inspected: scan.inspected, saved, alreadyKnown: scan.discovered.length - saved });
  } catch {
    const finishedAt = new Date().toISOString();
    await db
      .update(syncJobs)
      .set({ status: "failed", errorCode: "gmail_sync_failed", finishedAt, updatedAt: finishedAt })
      .where(eq(syncJobs.id, jobId));
    throw new ApiError(502, "gmail_sync_failed", "Gmail could not be scanned. Try again in a moment.");
  }
});

gmailRoutes.post("/read", requireMutationCsrf, async (c) => {
  const env = getEnv(c);
  const db = env.db;
  const userId = c.get("userId");
  const key = decodeEncryptionKey(env.TOKEN_ENCRYPTION_KEY);
  const connectionRows = await db
    .select()
    .from(oauthConnections)
    .where(and(eq(oauthConnections.userId, userId), eq(oauthConnections.provider, "gmail"), eq(oauthConnections.status, "connected")))
    .limit(1);
  const connection = connectionRows[0];
  if (!connection?.encryptedRefreshToken || !key) {
    throw new ApiError(409, "gmail_not_connected", "Connect Gmail before reading statements.");
  }
  const recent = await db
    .select({ startedAt: syncJobs.startedAt, status: syncJobs.status })
    .from(syncJobs)
    .where(and(eq(syncJobs.userId, userId), eq(syncJobs.kind, "gmail_statement_read")))
    .orderBy(desc(syncJobs.startedAt))
    .limit(1);
  const startedAt = recent[0]?.startedAt ? Date.parse(recent[0].startedAt) : Number.NaN;
  if ((recent[0]?.status === "running" || recent[0]?.status === "succeeded") && Date.now() - startedAt < 15_000) {
    throw new ApiError(429, "sync_too_soon", "Wait a few seconds before reading again.");
  }
  const now = new Date().toISOString();
  const jobId = crypto.randomUUID();
  await db.insert(syncJobs).values({
    id: jobId,
    userId,
    kind: "gmail_statement_read",
    status: "running",
    retryCount: 0,
    startedAt: now,
    createdAt: now,
    updatedAt: now,
  });
  try {
    const refreshToken = await openSeal(key, connection.encryptedRefreshToken);
    const accessToken = await refreshGmailAccessToken(env, refreshToken);
    const result = await readSavedStatements(env, userId, accessToken);
    const finishedAt = new Date().toISOString();
    await db.update(syncJobs).set({ status: "succeeded", finishedAt, updatedAt: finishedAt }).where(eq(syncJobs.id, jobId));
    return c.json(result);
  } catch {
    const finishedAt = new Date().toISOString();
    await db
      .update(syncJobs)
      .set({ status: "failed", errorCode: "gmail_read_failed", finishedAt, updatedAt: finishedAt })
      .where(eq(syncJobs.id, jobId));
    throw new ApiError(502, "gmail_read_failed", "Saved statements could not be read. Try again in a moment.");
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
