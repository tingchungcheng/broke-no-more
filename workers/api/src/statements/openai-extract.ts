import {
  parseDecimalToMinor,
  parseStatementDate,
  reconcileStatementRow,
  TRANSACTION_TYPES,
  type ParsedStatement,
  type ParsedStatementTransaction,
  type StatementTypeSuggestion,
} from "@broke-no-more/shared";

const MODEL = "gpt-4.1-mini";
const MAX_CHARS = 12_000;

export function transactionsFromModelJson(body: unknown): ParsedStatement | null {
  if (!body || typeof body !== "object" || !("transactions" in body)) return null;
  const rows = (body as { transactions?: unknown }).transactions;
  if (!Array.isArray(rows)) return null;
  const transactions: ParsedStatement["transactions"] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const record = row as Record<string, unknown>;
    const date = typeof record.date === "string" ? parseStatementDate(record.date) : null;
    const description = typeof record.description === "string" ? record.description.trim() : "";
    const direction = record.direction === "IN" || record.direction === "OUT" ? record.direction : null;
    const suggestedType = TRANSACTION_TYPES.find((type) => type === record.transactionType) ?? null;
    const currency = typeof record.currency === "string" && /^[A-Z]{3}$/.test(record.currency) ? record.currency : null;
    const amountRaw = typeof record.amount === "string" || typeof record.amount === "number" ? String(record.amount) : "";
    const amount = amountRaw.replace(/,/g, "").replace(/^[+-]/, "").trim();
    if (!date || description.length < 2 || !direction) continue;
    let amountMinor: number;
    try {
      amountMinor = parseDecimalToMinor(amount, currency ?? "MYR");
    } catch {
      continue;
    }
    if (amountMinor <= 0) continue;
    transactions.push({
      transactionDate: date,
      description: description.slice(0, 200),
      amountMinor,
      currency,
      direction,
      transactionType: suggestedType ?? (direction === "IN" ? "INCOME" : "EXPENSE"),
    });
    if (transactions.length === 200) break;
  }
  if (transactions.length === 0) return null;
  return {
    parserVersion: "openai-extract-v1",
    transactions,
    warnings: ["Extracted by model. Review every row."],
  };
}

export async function extractStatementWithOpenAi(apiKey: string, text: string): Promise<ParsedStatement | null> {
  const trimmed = text.trim().slice(0, MAX_CHARS);
  if (trimmed.length < 40) return null;
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              'Extract bank or card statement transactions from the text. Reply with JSON {"transactions":[{"date":"YYYY-MM-DD","description":"merchant","amount":"12.50","currency":"MYR","direction":"OUT","transactionType":"EXPENSE"}]}. direction is IN when this account received money and OUT when it was charged. transactionType is EXPENSE, INCOME, REFUND, REPAYMENT, TRANSFER, or OTHER. On a credit card, PAYMENT THANK YOU and PAYMENT RECEIVED are IN and REPAYMENT, not income. A purchase is OUT and EXPENSE. Do not include previous balance, total balance, minimum payment, or credit limit. Do not invent rows. If no transaction lines are visible, return {"transactions":[]}. Do not assign a confidence score.',
          },
          { role: "user", content: trimmed },
        ],
      }),
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) return null;
    return transactionsFromModelJson(JSON.parse(content) as unknown);
  } catch {
    return null;
  }
}

export function applyModelClassifications<T extends ParsedStatementTransaction>(
  rows: T[],
  body: unknown,
  accountType = "",
): T[] {
  const suggestions = new Map<number, StatementTypeSuggestion>();
  if (body && typeof body === "object" && "rows" in body && Array.isArray((body as { rows?: unknown }).rows)) {
    for (const item of (body as { rows: unknown[] }).rows) {
      if (!item || typeof item !== "object") continue;
      const record = item as Record<string, unknown>;
      const index = typeof record.index === "number" ? record.index : Number(record.index);
      if (!Number.isInteger(index)) continue;
      suggestions.set(index, {
        direction: typeof record.direction === "string" ? record.direction : undefined,
        transactionType: typeof record.transactionType === "string" ? record.transactionType : undefined,
      });
    }
  }
  return rows.map((row, index) => {
    const next = reconcileStatementRow({
      ...row,
      accountType,
      suggestion: suggestions.get(index) ?? null,
    });
    return { ...row, direction: next.direction, transactionType: next.transactionType };
  });
}

export async function classifyStatementRows<T extends ParsedStatementTransaction>(
  apiKey: string,
  accountType: string,
  rows: T[],
): Promise<T[]> {
  if (rows.length === 0) return rows;
  const payloadRows = rows.slice(0, 80).map((row, index) => ({
    index,
    description: row.description.slice(0, 120),
    direction: row.direction,
    amountMinor: row.amountMinor,
  }));
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              'Classify these existing statement rows. Do not add or remove rows and do not change amounts. Reply with JSON {"rows":[{"index":0,"direction":"OUT","transactionType":"EXPENSE"}]}. direction IN means this account received money. OUT means it was charged. transactionType is EXPENSE, INCOME, REFUND, REPAYMENT, TRANSFER, INVESTMENT, or OTHER. On a credit card, PAYMENT THANK YOU and PAYMENT RECEIVED are IN and REPAYMENT, not income. A merchant charge is OUT and EXPENSE even if the description contains the word repayment. Do not assign a confidence score.',
          },
          { role: "user", content: JSON.stringify({ accountType, rows: payloadRows }) },
        ],
      }),
    });
    if (!response.ok) return applyModelClassifications(rows, null, accountType);
    const payload = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const content = payload.choices?.[0]?.message?.content;
    return applyModelClassifications(rows, content ? (JSON.parse(content) as unknown) : null, accountType);
  } catch {
    return applyModelClassifications(rows, null, accountType);
  }
}
