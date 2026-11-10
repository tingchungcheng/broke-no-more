import { and, eq } from "drizzle-orm";
import { oauthConnections, users } from "@broke-no-more/database";
import { sessionResponseSchema, type SessionResponse } from "@broke-no-more/shared";
import { bytesToBase64Url, sha256Hex } from "./crypto";
import type { GoogleIdentity } from "./claims";
import type { Database } from "../db";
import { sessions } from "@broke-no-more/database";

export async function upsertIdentity(db: Database, identity: GoogleIdentity) {
  const now = new Date().toISOString();
  const existing = await db.select().from(users).where(eq(users.googleSub, identity.sub)).limit(1);
  const current = existing[0];
  if (current) {
    await db
      .update(users)
      .set({
        email: identity.email,
        name: identity.name,
        pictureUrl: identity.pictureUrl,
        updatedAt: now,
      })
      .where(eq(users.id, current.id));
    return { ...current, email: identity.email, name: identity.name, pictureUrl: identity.pictureUrl, updatedAt: now };
  }

  const created = {
    id: crypto.randomUUID(),
    googleSub: identity.sub,
    email: identity.email,
    name: identity.name,
    pictureUrl: identity.pictureUrl,
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(users).values(created);
  return created;
}

export async function createSession(db: Database, userId: string) {
  const token = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  const csrfToken = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  const now = new Date();
  await db.insert(sessions).values({
    id: crypto.randomUUID(),
    userId,
    tokenHash: await sha256Hex(token),
    csrfToken,
    expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: now.toISOString(),
  });
  return { token, csrfToken };
}

export async function findActiveSession(db: Database, token: string) {
  const rows = await db
    .select()
    .from(sessions)
    .where(eq(sessions.tokenHash, await sha256Hex(token)))
    .limit(1);
  const session = rows[0];
  if (!session) return null;
  if (Date.parse(session.expiresAt) <= Date.now()) {
    await db.delete(sessions).where(eq(sessions.id, session.id));
    return null;
  }
  return session;
}

export async function deleteSessionById(db: Database, sessionId: string) {
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}

export async function findUser(db: Database, userId: string) {
  const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return rows[0] ?? null;
}

export async function sessionResponse(db: Database, userId: string, csrfToken: string): Promise<SessionResponse> {
  const user = await findUser(db, userId);
  if (!user) {
    throw new Error("Session user is missing.");
  }
  const connected = await db
    .select({ id: oauthConnections.id })
    .from(oauthConnections)
    .where(and(eq(oauthConnections.userId, userId), eq(oauthConnections.provider, "gmail"), eq(oauthConnections.status, "connected")))
    .limit(1);
  return sessionResponseSchema.parse({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      pictureUrl: user.pictureUrl,
    },
    csrfToken,
    gmailConnected: Boolean(connected[0]),
  });
}
