import type { Direction, TransactionType } from "./constants";
import { parseDecimalToMinor } from "./money";

export type ParsedStatementTransaction = {
  transactionDate: string;
  description: string;
  amountMinor: number;
  currency: string | null;
  direction: Direction;
  transactionType: TransactionType;
};

export type ParsedStatement = {
  parserVersion: "csv-columns-v1" | "text-line-v1" | "openai-extract-v1";
  transactions: ParsedStatementTransaction[];
  warnings: string[];
};

const DATE_HEADERS = new Set(["date", "transaction date", "txn date", "posting date"]);
const DESCRIPTION_HEADERS = new Set(["description", "details", "narrative", "particulars", "transaction description"]);
const AMOUNT_HEADERS = new Set(["amount", "transaction amount"]);
const DEBIT_HEADERS = new Set(["debit", "withdrawal", "money out"]);
const CREDIT_HEADERS = new Set(["credit", "deposit", "money in"]);
const CURRENCY_HEADERS = new Set(["currency"]);
const DIRECTION_HEADERS = new Set(["direction", "drcr"]);

function headerIndex(headers: string[], names: Set<string>): number {
  return headers.findIndex((header) => names.has(header.trim().toLowerCase()));
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const source = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index] ?? "";
    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else quoted = false;
      } else cell += char;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((columns) => columns.some((column) => column.trim().length > 0));
}

export function parseStatementDate(value: string): string | null {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return validIso(trimmed);
  const match = trimmed.match(/^(\d{2})[./-](\d{2})[./-](\d{4})$/);
  if (!match) return null;
  return validIso(`${match[3]}-${match[2]}-${match[1]}`);
}

function validIso(value: string): string | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) return null;
  return value;
}

function parseAmount(raw: string): { amount: string; direction: Direction | null } | null {
  let value = raw.trim().replace(/\s+/g, "").replace(/MYR|RM/gi, "").replace(/,/g, "");
  if (!value) return null;
  let direction: Direction | null = null;
  const marked = value.match(/^(.*?)(DR|CR)$/i);
  if (marked?.[1] && marked[2]) {
    direction = marked[2].toUpperCase() === "CR" ? "IN" : "OUT";
    value = marked[1];
  }
  if (value.startsWith("(") && value.endsWith(")")) {
    direction = "OUT";
    value = value.slice(1, -1);
  }
  if (value.startsWith("-")) {
    direction = "OUT";
    value = value.slice(1);
  } else if (value.startsWith("+")) {
    direction = direction ?? "IN";
    value = value.slice(1);
  }
  if (!/^\d+(\.\d+)?$/.test(value)) return null;
  return { amount: value, direction };
}

function toMinor(raw: string, currency: string): number | null {
  const parsed = parseAmount(raw);
  if (!parsed) return null;
  try {
    return parseDecimalToMinor(parsed.amount, currency);
  } catch {
    return null;
  }
}

function directionOf(raw: string, fallback: Direction | null): Direction | null {
  return parseAmount(raw)?.direction ?? fallback;
}

function parseCsvStatement(text: string): ParsedStatement | null {
  const rows = parseCsv(text);
  const headers = rows[0];
  if (!headers) return null;
  const dateIndex = headerIndex(headers, DATE_HEADERS);
  const descriptionIndex = headerIndex(headers, DESCRIPTION_HEADERS);
  const amountIndex = headerIndex(headers, AMOUNT_HEADERS);
  const debitIndex = headerIndex(headers, DEBIT_HEADERS);
  const creditIndex = headerIndex(headers, CREDIT_HEADERS);
  const currencyIndex = headerIndex(headers, CURRENCY_HEADERS);
  const directionIndex = headerIndex(headers, DIRECTION_HEADERS);
  if (dateIndex < 0 || descriptionIndex < 0 || (amountIndex < 0 && debitIndex < 0 && creditIndex < 0)) return null;

  const transactions: ParsedStatementTransaction[] = [];
  const warnings: string[] = [];
  for (const columns of rows.slice(1)) {
    const date = parseStatementDate(columns[dateIndex] ?? "");
    const description = (columns[descriptionIndex] ?? "").trim().replace(/\s+/g, " ");
    if (!date || !description) {
      warnings.push("A row was missing a date or description.");
      continue;
    }
    const currencyRaw = currencyIndex >= 0 ? (columns[currencyIndex] ?? "").trim().toUpperCase() : "";
    const currency = /^[A-Z]{3}$/.test(currencyRaw) ? currencyRaw : null;
    const moneyCurrency = currency ?? "MYR";
    const explicit = directionIndex >= 0 ? (columns[directionIndex] ?? "").trim().toUpperCase() : "";
    let direction: Direction | null = explicit === "IN" || explicit === "CR" ? "IN" : explicit === "OUT" || explicit === "DR" ? "OUT" : null;
    let amountMinor: number | null = null;
    if (amountIndex >= 0 && (columns[amountIndex] ?? "").trim()) {
      const raw = columns[amountIndex] ?? "";
      amountMinor = toMinor(raw, moneyCurrency);
      direction = direction ?? directionOf(raw, null);
    } else {
      const debit = debitIndex >= 0 ? (columns[debitIndex] ?? "").trim() : "";
      const credit = creditIndex >= 0 ? (columns[creditIndex] ?? "").trim() : "";
      if (debit && credit) {
        warnings.push("A row had both a debit and a credit.");
        continue;
      }
      if (debit) {
        amountMinor = toMinor(debit, moneyCurrency);
        direction = "OUT";
      } else if (credit) {
        amountMinor = toMinor(credit, moneyCurrency);
        direction = "IN";
      }
    }
    if (amountMinor == null || amountMinor <= 0 || !direction) {
      warnings.push("A row did not have a usable amount.");
      continue;
    }
    transactions.push({
      transactionDate: date,
      description,
      amountMinor,
      currency,
      direction,
      transactionType: direction === "IN" ? "INCOME" : "EXPENSE",
    });
  }
  if (transactions.length === 0) return null;
  return { parserVersion: "csv-columns-v1", transactions, warnings };
}

function parseTextLines(text: string): ParsedStatement | null {
  const transactions: ParsedStatementTransaction[] = [];
  const warnings: string[] = [];
  for (const line of text.split(/\n+/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const iso = trimmed.match(/^(\d{4}-\d{2}-\d{2})\s+(.+?)\s+([+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{2})?)$/);
    const dmy = trimmed.match(/^(\d{2}[./-]\d{2}[./-]\d{4})\s+(.+?)\s+((?:\d{1,3}(?:,\d{3})+|\d+)\.\d{2})\s+(DR|CR)$/i);
    const match = iso ?? dmy;
    if (!match) {
      if (/\d{4}-\d{2}-\d{2}|\d{2}[./-]\d{2}[./-]\d{4}/.test(trimmed) && /\d+\.\d{2}/.test(trimmed)) {
        warnings.push("A line looked like a transaction but did not match the supported layout.");
      }
      continue;
    }
    const date = parseStatementDate(match[1] ?? "");
    const description = (match[2] ?? "").trim().replace(/\s+/g, " ");
    const amount = toMinor(match[3] ?? "", "MYR");
    const direction = dmy ? (match[4]?.toUpperCase() === "CR" ? "IN" : "OUT") : directionOf(match[3] ?? "", "OUT");
    if (!date || !description || amount == null || amount <= 0 || !direction) {
      warnings.push("A line looked like a transaction but did not match the supported layout.");
      continue;
    }
    transactions.push({
      transactionDate: date,
      description,
      amountMinor: amount,
      currency: null,
      direction,
      transactionType: direction === "IN" ? "INCOME" : "EXPENSE",
    });
  }
  if (transactions.length === 0) return null;
  return { parserVersion: "text-line-v1", transactions, warnings };
}

export function parseStatementText(filename: string, text: string): ParsedStatement | null {
  if (filename.toLowerCase().endsWith(".csv") || /^date\s*,/i.test(text.trim())) return parseCsvStatement(text);
  return parseTextLines(text);
}
