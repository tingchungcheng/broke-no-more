import { and, asc, count, desc, eq } from "drizzle-orm";
import { statements, syncJobs } from "@broke-no-more/database";
import type { Database } from "../db";

export const STATEMENTS_PAGE_SIZE = 10;

export const STATEMENT_LIST_SORT_FIELDS = ["receivedOn", "createdAt", "subject", "status", "sender"] as const;
export type StatementListSort = (typeof STATEMENT_LIST_SORT_FIELDS)[number];
export type StatementListOrder = "asc" | "desc";

export async function listStatementsPage(
  db: Database,
  userId: string,
  page: number,
  pageSize = STATEMENTS_PAGE_SIZE,
  options: { sort?: StatementListSort; order?: StatementListOrder } = {},
) {
  const sort = options.sort ?? "receivedOn";
  const order = options.order ?? "desc";
  const sortColumn = {
    receivedOn: statements.receivedOn,
    createdAt: statements.createdAt,
    subject: statements.subject,
    status: statements.status,
    sender: statements.sender,
  }[sort];
  const where = eq(statements.userId, userId);
  const countRows = await db.select({ value: count() }).from(statements).where(where);
  const total = Number(countRows[0]?.value ?? 0);
  const offset = (page - 1) * pageSize;
  const rows = await db
    .select()
    .from(statements)
    .where(where)
    .orderBy(order === "asc" ? asc(sortColumn) : desc(sortColumn))
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
