import { statementPasswords } from "@broke-no-more/database";
import { MAX_ACCOUNT_STATEMENT_KEYWORDS, normalizeAccountStatementKeywords, normalizeStatementKeyword } from "@broke-no-more/shared";
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
    label: z.string().optional(),
    labels: z.array(z.string()).max(MAX_ACCOUNT_STATEMENT_KEYWORDS).optional(),
    password: z
      .union([z.string().trim().min(1).max(80), z.null(), z.literal("")])
      .optional()
      .transform((value) => (value && value.length > 0 ? value : undefined)),
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
  const env = getEnv(c);
  const userId = c.get("userId");

  if (input.labels !== undefined) {
    if (!input.accountId) {
      throw new ApiError(400, "validation_error", "Choose an account when saving subject phrases.");
    }
    const account = await findAccount(env.db, userId, input.accountId);
    if (!account) throw new ApiError(404, "account_not_found", "Account not found.");
    if (input.labels.length > MAX_ACCOUNT_STATEMENT_KEYWORDS) {
      throw new ApiError(400, "validation_error", `Use at most ${MAX_ACCOUNT_STATEMENT_KEYWORDS} subject phrases per account.`);
    }
    const labels = normalizeAccountStatementKeywords(input.labels);
    if (labels.length !== input.labels.length) {
      throw new ApiError(400, "validation_error", "Use short names without search operators, up to three per account.");
    }
    return c.json(await syncAccountStatementPasswords(env, userId, input.accountId, labels, input.password));
  }

  if (!input.label || !input.password) {
    throw new ApiError(400, "validation_error", "Send a label and password, or an account with up to three labels.");
  }
  const label = normalizeStatementKeyword(input.label);
  if (!label) throw new ApiError(400, "validation_error", "Use a short institution name, without search operators.");
  if (input.accountId) {
    const account = await findAccount(env.db, userId, input.accountId);
    if (!account) throw new ApiError(404, "account_not_found", "Account not found.");
  }
  const key = decodeEncryptionKey(env.TOKEN_ENCRYPTION_KEY);
  if (!key) throw new ApiError(409, "gmail_not_configured", "The API is missing its token encryption key.");
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

async function syncAccountStatementPasswords(
  env: ReturnType<typeof getEnv>,
  userId: string,
  accountId: string,
  labels: string[],
  password: string | undefined,
) {
  const key = decodeEncryptionKey(env.TOKEN_ENCRYPTION_KEY);
  if (!key) throw new ApiError(409, "gmail_not_configured", "The API is missing its token encryption key.");
  const existing = await env.db.select().from(statementPasswords).where(eq(statementPasswords.userId, userId));
  const onAccount = existing.filter((row) => row.accountId === accountId);
  const now = new Date().toISOString();

  if (labels.length === 0) {
    for (const row of onAccount) {
      await env.db
        .delete(statementPasswords)
        .where(and(eq(statementPasswords.id, row.id), eq(statementPasswords.userId, userId)));
    }
    return { accountId, labels: [] as string[], passwords: [] as { id: string; label: string }[] };
  }

  let sealed: string;
  if (password) {
    sealed = await sealString(key, password);
  } else if (onAccount[0]) {
    sealed = onAccount[0].encryptedPassword;
  } else {
    throw new ApiError(400, "validation_error", "Enter the PDF password when adding subject phrases.");
  }

  const keep = new Set(labels.map((label) => label.toLowerCase()));
  for (const row of onAccount) {
    if (!keep.has(row.label.toLowerCase())) {
      await env.db
        .delete(statementPasswords)
        .where(and(eq(statementPasswords.id, row.id), eq(statementPasswords.userId, userId)));
    }
  }

  const saved: { id: string; label: string }[] = [];
  for (const label of labels) {
    const current = existing.find((row) => row.label.toLowerCase() === label.toLowerCase());
    if (current) {
      await env.db
        .update(statementPasswords)
        .set({
          label,
          encryptedPassword: sealed,
          encryptionKeyVersion: "v1",
          accountId,
          updatedAt: now,
        })
        .where(and(eq(statementPasswords.id, current.id), eq(statementPasswords.userId, userId)));
      saved.push({ id: current.id, label });
      continue;
    }
    const id = crypto.randomUUID();
    await env.db.insert(statementPasswords).values({
      id,
      userId,
      label,
      encryptedPassword: sealed,
      encryptionKeyVersion: "v1",
      accountId,
      createdAt: now,
      updatedAt: now,
    });
    saved.push({ id, label });
  }

  return { accountId, labels, passwords: saved };
}
