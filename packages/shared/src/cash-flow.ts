import type { Direction, TransactionStatus, TransactionType } from "./constants";

export type CashFlowRow = {
  transactionDate: string;
  amountMinor: number;
  currency: string;
  direction: Direction;
  transactionType: TransactionType;
  status: TransactionStatus;
};

export type MonthlyCashFlow = {
  month: string;
  moneyInMinor: number;
  moneyOutMinor: number;
};

export type SpendingSlice = {
  transactionType: TransactionType;
  amountMinor: number;
};

const OMITTED_FROM_CASH_FLOW = new Set<TransactionType>(["TRANSFER", "REPAYMENT"]);

export type CashFlowOptions = {
  includeNeedsReview?: boolean;
};

function countsTowardCashFlow(row: CashFlowRow, currency: string, options: CashFlowOptions): boolean {
  const statusOk = row.status === "CONFIRMED" || (options.includeNeedsReview === true && row.status === "PENDING_REVIEW");
  return (
    statusOk &&
    row.currency === currency &&
    !OMITTED_FROM_CASH_FLOW.has(row.transactionType) &&
    Number.isSafeInteger(row.amountMinor) &&
    row.amountMinor >= 0 &&
    /^\d{4}-\d{2}-\d{2}$/.test(row.transactionDate)
  );
}

function monthKey(isoDate: string): string {
  return isoDate.slice(0, 7);
}

function monthsBetween(start: string, end: string): string[] {
  const [startYear, startMonth] = start.split("-").map(Number);
  const [endYear, endMonth] = end.split("-").map(Number);
  const months: string[] = [];
  let year = startYear ?? 0;
  let month = startMonth ?? 1;
  const last = (endYear ?? 0) * 12 + (endMonth ?? 1);
  while (year * 12 + month <= last) {
    months.push(`${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`);
    month += 1;
    if (month === 13) {
      month = 1;
      year += 1;
    }
  }
  return months;
}

export function monthlyCashFlow(
  rows: readonly CashFlowRow[],
  currency: string,
  options: CashFlowOptions = {},
): MonthlyCashFlow[] {
  const totals = new Map<string, MonthlyCashFlow>();
  for (const row of rows) {
    if (!countsTowardCashFlow(row, currency, options)) continue;
    const month = monthKey(row.transactionDate);
    const current = totals.get(month) ?? { month, moneyInMinor: 0, moneyOutMinor: 0 };
    if (row.direction === "IN") current.moneyInMinor += row.amountMinor;
    else current.moneyOutMinor += row.amountMinor;
    totals.set(month, current);
  }
  const keys = [...totals.keys()].sort();
  const first = keys[0];
  const last = keys[keys.length - 1];
  if (!first || !last) return [];
  return monthsBetween(first, last).map(
    (month) => totals.get(month) ?? { month, moneyInMinor: 0, moneyOutMinor: 0 },
  );
}

export function spendingByType(
  rows: readonly CashFlowRow[],
  currency: string,
  options: CashFlowOptions = {},
): SpendingSlice[] {
  const totals = new Map<TransactionType, number>();
  for (const row of rows) {
    if (!countsTowardCashFlow(row, currency, options) || row.direction !== "OUT") continue;
    totals.set(row.transactionType, (totals.get(row.transactionType) ?? 0) + row.amountMinor);
  }
  return [...totals.entries()]
    .map(([transactionType, amountMinor]) => ({ transactionType, amountMinor }))
    .sort((left, right) => right.amountMinor - left.amountMinor || left.transactionType.localeCompare(right.transactionType));
}

export function chartCurrencies(rows: readonly CashFlowRow[], options: CashFlowOptions = {}): string[] {
  const currencies = new Set<string>();
  for (const row of rows) {
    const statusOk = row.status === "CONFIRMED" || (options.includeNeedsReview === true && row.status === "PENDING_REVIEW");
    if (statusOk && !OMITTED_FROM_CASH_FLOW.has(row.transactionType)) {
      currencies.add(row.currency);
    }
  }
  return [...currencies].sort((left, right) => {
    if (left === "MYR") return -1;
    if (right === "MYR") return 1;
    return left.localeCompare(right);
  });
}
