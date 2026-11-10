import { and, eq, gte, lt } from "drizzle-orm";
import { statements, transactions } from "@broke-no-more/database";
import { rollupDayStatus, statusFromScore, type ConfidenceStatus } from "@broke-no-more/shared";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../env";
import { getEnv } from "../http/context";
import { ApiError } from "../http/errors";
import { requireUser } from "../middleware/guards";

const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

function nextMonth(month: string): string {
  const [yearText, monthText] = month.split("-");
  const year = Number(yearText);
  const monthNumber = Number(monthText);
  if (monthNumber === 12) return `${year + 1}-01`;
  return `${year}-${String(monthNumber + 1).padStart(2, "0")}`;
}

export const calendarRoutes = new Hono<AppEnv>();
calendarRoutes.use("*", requireUser);

calendarRoutes.get("/", async (c) => {
  const month = monthSchema.safeParse(c.req.query("month"));
  if (!month.success) throw new ApiError(400, "validation_error", "Month must look like 2026-11.");
  const start = `${month.data}-01`;
  const end = `${nextMonth(month.data)}-01`;
  const db = getEnv(c).db;
  const userId = c.get("userId");
  const [transactionRows, statementRows] = await Promise.all([
    db
      .select({
        id: transactions.id,
        transactionDate: transactions.transactionDate,
        description: transactions.descriptionRaw,
        amountMinor: transactions.amountMinor,
        currency: transactions.currency,
        direction: transactions.direction,
        confidence: transactions.confidence,
        source: transactions.source,
      })
      .from(transactions)
      .where(and(eq(transactions.userId, userId), gte(transactions.transactionDate, start), lt(transactions.transactionDate, end))),
    db
      .select({
        id: statements.id,
        subject: statements.subject,
        sender: statements.sender,
        receivedOn: statements.receivedOn,
        matchedKeywords: statements.matchedKeywords,
        status: statements.status,
      })
      .from(statements)
      .where(and(eq(statements.userId, userId), gte(statements.receivedOn, start), lt(statements.receivedOn, end))),
  ]);

  const byDate = new Map<
    string,
    {
      statuses: ConfidenceStatus[];
      transactions: typeof transactionRows;
      statements: Array<{
        id: string;
        subject: string | null;
        sender: string | null;
        matchedKeywords: string[];
        status: string;
      }>;
    }
  >();

  const day = (date: string) => {
    const current = byDate.get(date);
    if (current) return current;
    const created = { statuses: [], transactions: [], statements: [] };
    byDate.set(date, created);
    return created;
  };

  for (const row of transactionRows) {
    const bucket = day(row.transactionDate);
    bucket.transactions.push(row);
    bucket.statuses.push(statusFromScore(row.confidence, false));
  }
  for (const row of statementRows) {
    if (!row.receivedOn) continue;
    const bucket = day(row.receivedOn);
    bucket.statements.push({
      id: row.id,
      subject: row.subject,
      sender: row.sender,
      matchedKeywords: (row.matchedKeywords ?? "")
        .split(",")
        .map((keyword) => keyword.trim())
        .filter(Boolean),
      status: row.status,
    });
    bucket.statuses.push("needs_review");
  }

  const days = [...byDate.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, bucket]) => ({
      date,
      status: rollupDayStatus(bucket.statuses),
      transactions: bucket.transactions.map((row) => ({
        id: row.id,
        description: row.description,
        amountMinor: row.amountMinor,
        currency: row.currency,
        direction: row.direction,
        source: row.source,
      })),
      statements: bucket.statements,
    }));

  return c.json({ month: month.data, days });
});
