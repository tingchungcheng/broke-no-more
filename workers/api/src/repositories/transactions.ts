import { and, count, desc, eq, type SQL } from "drizzle-orm";
import { transactions } from "@broke-no-more/database";
import type { Database } from "../db";

export const TRANSACTIONS_PAGE_SIZE = 20;

export async function listTransactionsPage(db: Database, userId: string, page: number, accountId?: string) {
  const filters: SQL[] = [eq(transactions.userId, userId)];
  if (accountId) filters.push(eq(transactions.accountId, accountId));
  const where = and(...filters);
  const countRows = await db.select({ value: count() }).from(transactions).where(where);
  const total = Number(countRows[0]?.value ?? 0);
  const pageCount = total === 0 ? 0 : Math.ceil(total / TRANSACTIONS_PAGE_SIZE);
  const current = pageCount === 0 ? 1 : Math.min(page, pageCount);
  const rows = await db
    .select()
    .from(transactions)
    .where(where)
    .orderBy(desc(transactions.transactionDate), desc(transactions.createdAt))
    .limit(TRANSACTIONS_PAGE_SIZE)
    .offset((current - 1) * TRANSACTIONS_PAGE_SIZE);
  return {
    rows,
    page: current,
    pageSize: TRANSACTIONS_PAGE_SIZE,
    total,
    pageCount,
    hasMore: current < pageCount,
  };
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
