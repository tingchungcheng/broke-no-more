import { and, count, desc, eq } from "drizzle-orm";
import { statements, syncJobs } from "@broke-no-more/database";
import type { Database } from "../db";

export const STATEMENTS_PAGE_SIZE = 10;

export async function listStatementsPage(db: Database, userId: string, page: number, pageSize = STATEMENTS_PAGE_SIZE) {
  const where = eq(statements.userId, userId);
  const countRows = await db.select({ value: count() }).from(statements).where(where);
  const total = Number(countRows[0]?.value ?? 0);
  const offset = (page - 1) * pageSize;
  const rows = await db
    .select()
    .from(statements)
    .where(where)
    .orderBy(desc(statements.createdAt))
    .limit(pageSize)
    .offset(offset);
  const pageCount = total === 0 ? 0 : Math.ceil(total / pageSize);
  return { rows, total, page, pageSize, pageCount, hasMore: page < pageCount };
}

export async function findStatement(db: Database, userId: string, statementId: string) {
  const rows = await db
    .select()
    .from(statements)
    .where(and(eq(statements.userId, userId), eq(statements.id, statementId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function listSyncJobs(db: Database, userId: string) {
  return db.select().from(syncJobs).where(eq(syncJobs.userId, userId)).orderBy(desc(syncJobs.createdAt)).limit(101);
}
