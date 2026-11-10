import { Hono } from "hono";
import { transactions } from "@broke-no-more/database";
import {
  assertDirectionMatchesType,
  createTransactionSchema,
  DirectionError,
  MoneyError,
  normalizeDescription,
  parseDecimalToMinor,
  transactionSchema,
} from "@broke-no-more/shared";
import type { AppEnv } from "../env";
import { getEnv } from "../http/context";
import { ApiError } from "../http/errors";
import { readJson } from "../http/json";
import { requireMutationCsrf, requireUser } from "../middleware/guards";
import { findAccount } from "../repositories/accounts";
import { deleteTransaction, findTransaction, listTransactions } from "../repositories/transactions";
import { requireUuid } from "./ids";

function presentTransaction(row: typeof transactions.$inferSelect) {
  return transactionSchema.parse({
    id: row.id,
    accountId: row.accountId,
    statementId: row.statementId,
    transactionDate: row.transactionDate,
    postedDate: row.postedDate,
    description: row.descriptionRaw,
    merchantName: row.merchantName,
    amountMinor: row.amountMinor,
    currency: row.currency,
    direction: row.direction,
    transactionType: row.transactionType,
    categoryId: row.categoryId,
    status: row.status,
    source: row.source,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

export const transactionRoutes = new Hono<AppEnv>();
transactionRoutes.use("*", requireUser, requireMutationCsrf);

transactionRoutes.get("/", async (c) => {
  const requestedAccountId = c.req.query("accountId");
  const accountId = requestedAccountId ? requireUuid(requestedAccountId) : undefined;
  const rows = await listTransactions(getEnv(c).db, c.get("userId"), accountId);
  return c.json({
    transactions: rows.slice(0, 100).map(presentTransaction),
    truncated: rows.length > 100,
  });
});

transactionRoutes.post("/", async (c) => {
  const input = await readJson(c, createTransactionSchema);
  let amountMinor: number;
  try {
    amountMinor = parseDecimalToMinor(input.amount, input.currency);
    assertDirectionMatchesType(input.transactionType, input.direction);
  } catch (error) {
    if (error instanceof MoneyError || error instanceof DirectionError) {
      throw new ApiError(400, "invalid_transaction", error.message);
    }
    throw error;
  }

  const db = getEnv(c).db;
  const account = await findAccount(db, c.get("userId"), input.accountId);
  if (!account) throw new ApiError(404, "account_not_found", "Account not found.");
  if (account.currency !== input.currency) {
    throw new ApiError(400, "currency_mismatch", "The transaction currency must match the account currency.");
  }

  const now = new Date().toISOString();
  const row = {
    id: crypto.randomUUID(),
    userId: c.get("userId"),
    accountId: account.id,
    statementId: null,
    transactionDate: input.transactionDate,
    postedDate: input.postedDate ?? null,
    descriptionRaw: input.description,
    descriptionNormalized: normalizeDescription(input.description),
    merchantName: input.merchantName ?? null,
    amountMinor,
    currency: input.currency,
    direction: input.direction,
    transactionType: input.transactionType,
    categoryId: null,
    status: "CONFIRMED",
    confidence: null,
    source: "MANUAL",
    sourceReference: null,
    parserVersion: null,
    fingerprint: null,
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(transactions).values(row);
  return c.json({ transaction: presentTransaction(row) }, 201);
});

transactionRoutes.get("/:id", async (c) => {
  const row = await findTransaction(getEnv(c).db, c.get("userId"), requireUuid(c.req.param("id")));
  if (!row) throw new ApiError(404, "transaction_not_found", "Transaction not found.");
  return c.json({ transaction: presentTransaction(row) });
});

transactionRoutes.delete("/:id", async (c) => {
  const id = requireUuid(c.req.param("id"));
  const db = getEnv(c).db;
  const row = await findTransaction(db, c.get("userId"), id);
  if (!row) throw new ApiError(404, "transaction_not_found", "Transaction not found.");
  await deleteTransaction(db, c.get("userId"), id);
  return c.body(null, 204);
});
