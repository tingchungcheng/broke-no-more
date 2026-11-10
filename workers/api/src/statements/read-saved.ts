import { accounts, statementPasswords, statements, transactions } from "@broke-no-more/database";
import { normalizeDescription, parseStatementText } from "@broke-no-more/shared";
import { and, eq, inArray } from "drizzle-orm";
import { sha256Hex } from "../auth/crypto";
import { decodeEncryptionKey, openSeal, sealString } from "../auth/seal";
import type { Env } from "../env";
import { downloadAttachment, fetchMessagePayload, findStatementAttachments } from "../gmail/attachments";
import { extractPdfText } from "./pdf-text";
import { statementStorageRoot, storeSealedStatement } from "./store";

const MAX_BYTES = 8_000_000;
const RETRY_ERRORS = ["password_required", "password_rejected", "no_attachment", "account_required", "currency_mismatch"];

export type ReadSavedResult = {
  checked: number;
  filesStored: number;
  statementsImported: number;
  transactionsImported: number;
  locked: number;
  unrecognized: number;
  needsAccount: number;
};

type OpenedFile = { filename: string; text: string; bytes: Uint8Array };

async function openAttachment(
  bytes: Uint8Array,
  filename: string,
  passwords: string[],
): Promise<{ ok: true; text: string } | { ok: false; error: "password_required" | "password_rejected" | "unreadable" }> {
  if (!filename.toLowerCase().endsWith(".pdf")) {
    return { ok: true, text: new TextDecoder().decode(bytes) };
  }
  const unlocked = await extractPdfText(bytes);
  if (unlocked.ok || unlocked.error !== "password_required") return unlocked;
  if (passwords.length === 0) return { ok: false, error: "password_required" };
  let rejected = false;
  for (const password of passwords) {
    const attempt = await extractPdfText(bytes, password);
    if (attempt.ok) return attempt;
    if (attempt.error === "password_rejected") rejected = true;
  }
  return { ok: false, error: rejected ? "password_rejected" : "password_required" };
}

export async function readSavedStatements(env: Env, userId: string, accessToken: string): Promise<ReadSavedResult> {
  const key = decodeEncryptionKey(env.TOKEN_ENCRYPTION_KEY);
  const result: ReadSavedResult = {
    checked: 0,
    filesStored: 0,
    statementsImported: 0,
    transactionsImported: 0,
    locked: 0,
    unrecognized: 0,
    needsAccount: 0,
  };
  if (!key) return result;
  const db = env.db;
  const rows = await db
    .select()
    .from(statements)
    .where(
      and(
        eq(statements.userId, userId),
        eq(statements.source, "GMAIL"),
        inArray(statements.status, ["DISCOVERED", "REVIEW_REQUIRED", "FAILED"]),
      ),
    )
    .limit(40);
  const pending = rows.filter((row) => row.status === "DISCOVERED" || (row.errorCode != null && RETRY_ERRORS.includes(row.errorCode))).slice(0, 20);
  const presets = await db.select().from(statementPasswords).where(eq(statementPasswords.userId, userId));
  const openedPresets = await Promise.all(
    presets.map(async (preset) => ({
      label: preset.label,
      accountId: preset.accountId,
      password: await openSeal(key, preset.encryptedPassword),
    })),
  );

  for (const statement of pending) {
    if (!statement.gmailMessageId) continue;
    result.checked += 1;
    const keywords = (statement.matchedKeywords ?? "")
      .split(",")
      .map((keyword) => keyword.trim().toLowerCase())
      .filter(Boolean);
    const matches = openedPresets.filter((preset) => keywords.includes(preset.label.toLowerCase()));
    const accountId = matches.find((preset) => preset.accountId)?.accountId ?? null;
    try {
      const payload = await fetchMessagePayload(accessToken, statement.gmailMessageId);
      const attachments = findStatementAttachments(payload ?? undefined);
      if (attachments.length === 0) {
        await mark(env, statement.id, { status: "REVIEW_REQUIRED", errorCode: "no_attachment" });
        continue;
      }
      let opened: OpenedFile | null = null;
      let handled = false;
      let lock: "password_required" | "password_rejected" | "unreadable" | null = null;
      for (const attachment of attachments) {
        const bytes = await downloadAttachment(accessToken, statement.gmailMessageId, attachment.attachmentId);
        if (!bytes || bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) continue;
        const textResult = await openAttachment(bytes, attachment.filename, matches.map((preset) => preset.password));
        if (!textResult.ok) {
          lock = textResult.error;
          continue;
        }
        opened = { filename: attachment.filename, text: textResult.text, bytes };
        const parsed = parseStatementText(attachment.filename, textResult.text);
        if (parsed) {
          await finishParsed(env, key, result, statement, opened, parsed, accountId);
          handled = true;
          break;
        }
      }
      if (handled) {
        continue;
      }
      if (opened) {
        await storeAndMark(env, key, statement.userId, statement.id, opened, {
          status: "STORED",
          errorCode: "unrecognized_layout",
          parserVersion: null,
        });
        result.filesStored += 1;
        result.unrecognized += 1;
      } else if (lock === "password_required" || lock === "password_rejected") {
        await mark(env, statement.id, { status: "REVIEW_REQUIRED", errorCode: lock });
        result.locked += 1;
      } else {
        await mark(env, statement.id, { status: "FAILED", errorCode: lock ?? "read_failed" });
      }
    } catch {
      await mark(env, statement.id, { status: "FAILED", errorCode: "read_failed" });
    }
  }
  return result;
}

async function finishParsed(
  env: Env,
  key: NonNullable<ReturnType<typeof decodeEncryptionKey>>,
  result: ReadSavedResult,
  statement: { id: string; userId: string },
  opened: OpenedFile,
  parsed: NonNullable<ReturnType<typeof parseStatementText>>,
  accountId: string | null,
) {
  await storeAndMark(env, key, statement.userId, statement.id, opened, {
    status: "REVIEW_REQUIRED",
    errorCode: accountId ? null : "account_required",
    parserVersion: parsed.parserVersion,
  });
  result.filesStored += 1;
  if (!accountId) {
    result.needsAccount += 1;
    return;
  }
  const accountRows = await env.db.select().from(accounts).where(and(eq(accounts.userId, statement.userId), eq(accounts.id, accountId))).limit(1);
  const account = accountRows[0];
  if (!account) {
    await mark(env, statement.id, { status: "REVIEW_REQUIRED", errorCode: "account_required" });
    result.needsAccount += 1;
    return;
  }
  let imported = 0;
  let mismatched = 0;
  for (const row of parsed.transactions) {
    const currency = row.currency ?? account.currency;
    if (currency !== account.currency) {
      mismatched += 1;
      continue;
    }
    const fingerprint = await sha256Hex(
      `${statement.id}|${row.transactionDate}|${row.direction}|${row.amountMinor}|${normalizeDescription(row.description)}`,
    );
    const existing = await env.db
      .select({ id: transactions.id })
      .from(transactions)
      .where(and(eq(transactions.userId, statement.userId), eq(transactions.fingerprint, fingerprint)))
      .limit(1);
    if (existing[0]) continue;
    const now = new Date().toISOString();
    await env.db.insert(transactions).values({
      id: crypto.randomUUID(),
      userId: statement.userId,
      accountId: account.id,
      statementId: statement.id,
      transactionDate: row.transactionDate,
      postedDate: null,
      descriptionRaw: row.description,
      descriptionNormalized: normalizeDescription(row.description),
      merchantName: null,
      amountMinor: row.amountMinor,
      currency,
      direction: row.direction,
      transactionType: row.transactionType,
      categoryId: null,
      status: "PENDING_REVIEW",
      confidence: 60,
      source: "STATEMENT",
      sourceReference: statement.id,
      parserVersion: parsed.parserVersion,
      fingerprint,
      createdAt: now,
      updatedAt: now,
    });
    imported += 1;
  }
  if (imported === 0 && mismatched > 0) {
    await mark(env, statement.id, { status: "REVIEW_REQUIRED", errorCode: "currency_mismatch", parserVersion: parsed.parserVersion });
    return;
  }
  if (imported > 0) {
    result.statementsImported += 1;
    result.transactionsImported += imported;
  }
}

async function storeAndMark(
  env: Env,
  key: NonNullable<ReturnType<typeof decodeEncryptionKey>>,
  userId: string,
  statementId: string,
  opened: OpenedFile,
  patch: { status: string; errorCode: string | null; parserVersion: string | null },
) {
  const sealed = await sealString(key, Buffer.from(opened.bytes).toString("base64"));
  const storageKey = await storeSealedStatement(statementStorageRoot(env), userId, statementId, sealed);
  const now = new Date().toISOString();
  await env.db
    .update(statements)
    .set({
      status: patch.status,
      errorCode: patch.errorCode,
      parserVersion: patch.parserVersion,
      originalFilename: opened.filename,
      storageKey,
      updatedAt: now,
    })
    .where(and(eq(statements.id, statementId), eq(statements.userId, userId)));
}

async function mark(
  env: Env,
  statementId: string,
  patch: { status: string; errorCode: string | null; parserVersion?: string | null },
) {
  const now = new Date().toISOString();
  await env.db
    .update(statements)
    .set({
      status: patch.status,
      errorCode: patch.errorCode,
      ...(patch.parserVersion === undefined ? {} : { parserVersion: patch.parserVersion }),
      updatedAt: now,
    })
    .where(eq(statements.id, statementId));
}
