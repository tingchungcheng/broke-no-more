import { statementPasswords } from "@broke-no-more/database";
import { normalizeStatementKeyword } from "@broke-no-more/shared";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { decodeEncryptionKey, sealString } from "../auth/seal";
import type { AppEnv } from "../env";
import { getEnv } from "../http/context";
import { ApiError } from "../http/errors";
import { readJson } from "../http/json";
import { requireMutationCsrf, requireUser } from "../middleware/guards";
import { findAccount } from "../repositories/accounts";

const saveSchema = z
  .object({
    label: z.string(),
    password: z.string().min(1).max(80),
    accountId: z.string().uuid().nullable().optional(),
  })
  .strict();

export const statementPasswordRoutes = new Hono<AppEnv>();
statementPasswordRoutes.use("*", requireUser, requireMutationCsrf);

statementPasswordRoutes.get("/", async (c) => {
  const rows = await getEnv(c)
    .db.select({
      id: statementPasswords.id,
      label: statementPasswords.label,
      accountId: statementPasswords.accountId,
      updatedAt: statementPasswords.updatedAt,
    })
    .from(statementPasswords)
    .where(eq(statementPasswords.userId, c.get("userId")));
  return c.json({ passwords: rows });
});

statementPasswordRoutes.put("/", async (c) => {
  const input = await readJson(c, saveSchema);
  const label = normalizeStatementKeyword(input.label);
  if (!label) throw new ApiError(400, "validation_error", "Use a short institution name, without search operators.");
  const env = getEnv(c);
  const key = decodeEncryptionKey(env.TOKEN_ENCRYPTION_KEY);
  if (!key) throw new ApiError(409, "gmail_not_configured", "The API is missing its token encryption key.");
  const userId = c.get("userId");
  if (input.accountId) {
    const account = await findAccount(env.db, userId, input.accountId);
    if (!account) throw new ApiError(404, "account_not_found", "Account not found.");
  }
  const sealed = await sealString(key, input.password);
  const now = new Date().toISOString();
  const existing = await env.db.select().from(statementPasswords).where(eq(statementPasswords.userId, userId));
  const current = existing.find((row) => row.label.toLowerCase() === label.toLowerCase());
  if (current) {
    await env.db
      .update(statementPasswords)
      .set({
        label,
        encryptedPassword: sealed,
        encryptionKeyVersion: "v1",
        accountId: input.accountId ?? null,
        updatedAt: now,
      })
      .where(and(eq(statementPasswords.id, current.id), eq(statementPasswords.userId, userId)));
    return c.json({ password: { id: current.id, label, accountId: input.accountId ?? null } });
  }
  const id = crypto.randomUUID();
  await env.db.insert(statementPasswords).values({
    id,
    userId,
    label,
    encryptedPassword: sealed,
    encryptionKeyVersion: "v1",
    accountId: input.accountId ?? null,
    createdAt: now,
    updatedAt: now,
  });
  return c.json({ password: { id, label, accountId: input.accountId ?? null } }, 201);
});
