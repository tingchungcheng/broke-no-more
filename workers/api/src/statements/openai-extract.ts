import { parseDecimalToMinor, parseStatementDate, type ParsedStatement } from "@broke-no-more/shared";

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
      transactionType: direction === "IN" ? "INCOME" : "EXPENSE",
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
              'Extract bank or card statement transactions from the text. Reply with JSON {"transactions":[{"date":"YYYY-MM-DD","description":"merchant","amount":"12.50","currency":"MYR","direction":"OUT"}]}. direction is IN for money received and OUT for money spent. Amounts are positive. Do not invent rows. If no transaction lines are visible, return {"transactions":[]}.',
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
