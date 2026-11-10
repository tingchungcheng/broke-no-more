import { and, desc, eq } from "drizzle-orm";
import { statements, syncJobs } from "@broke-no-more/database";
import type { Database } from "../db";

export async function listStatements(db: Database, userId: string) {
  return db.select().from(statements).where(eq(statements.userId, userId)).orderBy(desc(statements.createdAt)).limit(101);
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
