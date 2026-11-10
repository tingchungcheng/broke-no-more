import { accounts, transactions } from "@broke-no-more/database";
import { normalizeDescription, type ParsedStatementTransaction } from "@broke-no-more/shared";
import { and, eq } from "drizzle-orm";
import { sha256Hex } from "../auth/crypto";
import type { Env } from "../env";
import { classifyStatementRows } from "./openai-extract";

export async function reclassifyPendingStatementRows(env: Env, userId: string): Promise<number> {
  if (!env.OPENAI_API_KEY) return 0;
  const rows = await env.db
    .select({
      id: transactions.id,
      statementId: transactions.statementId,
      transactionDate: transactions.transactionDate,
      descriptionRaw: transactions.descriptionRaw,
      amountMinor: transactions.amountMinor,
      currency: transactions.currency,
      direction: transactions.direction,
      transactionType: transactions.transactionType,
      fingerprint: transactions.fingerprint,
      accountType: accounts.type,
    })
    .from(transactions)
    .innerJoin(accounts, eq(transactions.accountId, accounts.id))
    .where(and(eq(transactions.userId, userId), eq(transactions.source, "STATEMENT"), eq(transactions.status, "PENDING_REVIEW")))
    .limit(80);
  if (rows.length === 0) return 0;
  const groups = new Map<string, typeof rows>();
  for (const row of rows) {
    const list = groups.get(row.accountType) ?? [];
    list.push(row);
    groups.set(row.accountType, list);
  }
  let updated = 0;
  for (const [accountType, group] of groups) {
    const classified = await classifyStatementRows(
      env.OPENAI_API_KEY,
      accountType,
      group.map(
        (row): ParsedStatementTransaction => ({
          transactionDate: row.transactionDate,
          description: row.descriptionRaw,
          amountMinor: row.amountMinor,
          currency: row.currency,
          direction: row.direction === "IN" ? "IN" : "OUT",
          transactionType: row.transactionType as ParsedStatementTransaction["transactionType"],
        }),
      ),
    );
    for (let index = 0; index < group.length; index += 1) {
    const current = group[index];
    const next = classified[index];
    if (!current || !next) continue;
    if (next.direction === current.direction && next.transactionType === current.transactionType) continue;
    const fingerprint =
      next.direction === current.direction
        ? current.fingerprint
        : await sha256Hex(
            `${current.statementId}|${current.transactionDate}|${next.direction}|${current.amountMinor}|${normalizeDescription(current.descriptionRaw)}`,
          );
    if (fingerprint && fingerprint !== current.fingerprint) {
      const clash = await env.db
        .select({ id: transactions.id })
        .from(transactions)
        .where(and(eq(transactions.userId, userId), eq(transactions.fingerprint, fingerprint)))
        .limit(1);
      if (clash[0]) continue;
    }
    await env.db
      .update(transactions)
      .set({
        direction: next.direction,
        transactionType: next.transactionType,
        fingerprint,
        updatedAt: new Date().toISOString(),
      })
      .where(and(eq(transactions.id, current.id), eq(transactions.userId, userId)));
    updated += 1;
    }
  }
  return updated;
}
