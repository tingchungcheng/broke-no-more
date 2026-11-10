import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { accounts, statementPasswords, statements, transactions } from "@broke-no-more/database";
import { closingBalanceFromText, parseDecimalToMinor } from "@broke-no-more/shared";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { decodeEncryptionKey, openSeal } from "../auth/seal";
import type { Env } from "../env";
import { extractPdfText } from "./pdf-text";
import { statementStorageRoot } from "./store";

export async function rememberClosingBalances(env: Env, userId: string): Promise<number> {
  const key = decodeEncryptionKey(env.TOKEN_ENCRYPTION_KEY);
  if (!key) return 0;
  const rows = await env.db
    .select({
      id: statements.id,
      accountId: statements.accountId,
      storageKey: statements.storageKey,
      receivedOn: statements.receivedOn,
    })
    .from(statements)
    .where(
      and(
        eq(statements.userId, userId),
        eq(statements.source, "GMAIL"),
        isNull(statements.closingBalanceMinor),
        isNotNull(statements.storageKey),
      ),
    )
    .limit(8);
  const presets = await env.db
    .select({ accountId: statementPasswords.accountId, encryptedPassword: statementPasswords.encryptedPassword })
    .from(statementPasswords)
    .where(eq(statementPasswords.userId, userId));
  let saved = 0;
  for (const row of rows) {
    if (!row.storageKey) continue;
    let accountId = row.accountId;
    if (!accountId) {
      const linked = await env.db
        .select({ accountId: transactions.accountId })
        .from(transactions)
        .where(and(eq(transactions.userId, userId), eq(transactions.statementId, row.id)))
        .limit(1);
      accountId = linked[0]?.accountId ?? null;
    }
    if (!accountId) continue;
    const accountRows = await env.db
      .select({ currency: accounts.currency })
      .from(accounts)
      .where(and(eq(accounts.userId, userId), eq(accounts.id, accountId)))
      .limit(1);
    const currency = accountRows[0]?.currency;
    if (!currency) continue;
    try {
      const sealed = await readFile(join(statementStorageRoot(env), row.storageKey), "utf8");
      const encoded = await openSeal(key, sealed);
      const bytes = Uint8Array.from(Buffer.from(encoded, "base64"));
      const preset = presets.find((item) => item.accountId === accountId);
      const password = preset ? await openSeal(key, preset.encryptedPassword) : undefined;
      const text = await extractPdfText(bytes, password);
      if (!text.ok) continue;
      const found = closingBalanceFromText(text.text);
      if (!found) continue;
      const amountMinor = parseDecimalToMinor(found.amount, currency);
      await env.db
        .update(statements)
        .set({
          accountId,
          closingBalanceMinor: amountMinor,
          balanceAsOf: row.receivedOn,
          updatedAt: new Date().toISOString(),
        })
        .where(and(eq(statements.id, row.id), eq(statements.userId, userId)));
      saved += 1;
    } catch {
      continue;
    }
  }
  return saved;
}
