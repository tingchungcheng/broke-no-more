import { and, desc, eq } from "drizzle-orm";
import { transactions } from "@broke-no-more/database";
import type { Database } from "../db";

export async function listTransactions(db: Database, userId: string, accountId?: string) {
  const where = accountId
    ? and(eq(transactions.userId, userId), eq(transactions.accountId, accountId))
    : eq(transactions.userId, userId);
  return db
    .select()
    .from(transactions)
    .where(where)
    .orderBy(desc(transactions.transactionDate), desc(transactions.createdAt))
    .limit(101);
}

export async function findTransaction(db: Database, userId: string, transactionId: string) {
  const rows = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.userId, userId), eq(transactions.id, transactionId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function deleteTransaction(db: Database, userId: string, transactionId: string) {
  await db.delete(transactions).where(and(eq(transactions.userId, userId), eq(transactions.id, transactionId)));
}
