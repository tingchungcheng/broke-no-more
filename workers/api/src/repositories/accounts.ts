import { and, desc, eq } from "drizzle-orm";
import { accounts } from "@broke-no-more/database";
import type { Database } from "../db";

export async function listAccounts(db: Database, userId: string) {
  return db.select().from(accounts).where(eq(accounts.userId, userId)).orderBy(desc(accounts.createdAt)).limit(101);
}

export async function findAccount(db: Database, userId: string, accountId: string) {
  const rows = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.id, accountId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function deleteAccount(db: Database, userId: string, accountId: string) {
  await db.delete(accounts).where(and(eq(accounts.userId, userId), eq(accounts.id, accountId)));
}
