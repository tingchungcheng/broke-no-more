import { accounts, statements, transactions } from "@broke-no-more/database";
import {
  chartCurrencies,
  monthlyCashFlow,
  netWorthFromSnapshots,
  spendingByType,
  type AccountType,
  type CashFlowRow,
} from "@broke-no-more/shared";
import { and, eq, isNotNull } from "drizzle-orm";
import { Hono } from "hono";
import type { AppEnv } from "../env";
import { getEnv } from "../http/context";
import { requireUser } from "../middleware/guards";

export const analyticsRoutes = new Hono<AppEnv>();
analyticsRoutes.use("*", requireUser);

analyticsRoutes.get("/overview", async (c) => {
  const db = getEnv(c).db;
  const userId = c.get("userId");
  const transactionRows = await db
    .select({
      transactionDate: transactions.transactionDate,
      amountMinor: transactions.amountMinor,
      currency: transactions.currency,
      direction: transactions.direction,
      transactionType: transactions.transactionType,
      status: transactions.status,
    })
    .from(transactions)
    .where(eq(transactions.userId, userId));
  const flowRows: CashFlowRow[] = transactionRows.map((row) => ({
    transactionDate: row.transactionDate,
    amountMinor: row.amountMinor,
    currency: row.currency,
    direction: row.direction === "IN" ? "IN" : "OUT",
    transactionType: row.transactionType as CashFlowRow["transactionType"],
    status: row.status as CashFlowRow["status"],
  }));
  const options = { includeNeedsReview: true };
  const currencies = chartCurrencies(flowRows, options);
  const currency = currencies[0] ?? "MYR";
  const accountRows = await db
    .select({
      id: accounts.id,
      type: accounts.type,
      currency: accounts.currency,
      displayName: accounts.displayName,
    })
    .from(accounts)
    .where(eq(accounts.userId, userId));
  const balanceRows = await db
    .select({
      accountId: statements.accountId,
      amountMinor: statements.closingBalanceMinor,
      asOfDate: statements.balanceAsOf,
    })
    .from(statements)
    .where(and(eq(statements.userId, userId), isNotNull(statements.closingBalanceMinor), isNotNull(statements.accountId)));
  const netWorth = netWorthFromSnapshots(
    accountRows.map((account) => ({
      id: account.id,
      type: account.type as AccountType,
      currency: account.currency,
      displayName: account.displayName,
    })),
    balanceRows.flatMap((row) =>
      row.accountId && row.amountMinor != null && row.asOfDate
        ? [{ accountId: row.accountId, amountMinor: row.amountMinor, asOfDate: row.asOfDate }]
        : [],
    ),
    currency,
  );
  return c.json({
    cashFlow: {
      currency,
      currencies,
      months: monthlyCashFlow(flowRows, currency, options),
      spending: spendingByType(flowRows, currency, options),
      includesNeedsReview: true,
    },
    netWorth,
  });
});
