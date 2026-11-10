import { describe, expect, it } from "vitest";
import { chartCurrencies, monthlyCashFlow, spendingByType, type CashFlowRow } from "./cash-flow";

function row(overrides: Partial<CashFlowRow> = {}): CashFlowRow {
  return {
    transactionDate: "2026-11-10",
    amountMinor: 1250,
    currency: "MYR",
    direction: "OUT",
    transactionType: "EXPENSE",
    status: "CONFIRMED",
    ...overrides,
  };
}

describe("monthly cash flow", () => {
  it("sums confirmed money in and out, and leaves transfers and repayments out", () => {
    const points = monthlyCashFlow(
      [
        row(),
        row({ transactionDate: "2026-11-02", amountMinor: 500000, direction: "IN", transactionType: "INCOME" }),
        row({ transactionDate: "2026-11-03", amountMinor: 2000, direction: "IN", transactionType: "REFUND" }),
        row({ transactionDate: "2026-11-04", amountMinor: 900000, direction: "OUT", transactionType: "TRANSFER" }),
        row({ transactionDate: "2026-11-05", amountMinor: 400000, direction: "OUT", transactionType: "REPAYMENT" }),
        row({ status: "PENDING_REVIEW", amountMinor: 999 }),
        row({ currency: "SGD", amountMinor: 800 }),
        row({ transactionDate: "2026-09-15", amountMinor: 300 }),
      ],
      "MYR",
    );

    expect(points).toEqual([
      { month: "2026-09", moneyInMinor: 0, moneyOutMinor: 300 },
      { month: "2026-10", moneyInMinor: 0, moneyOutMinor: 0 },
      { month: "2026-11", moneyInMinor: 502000, moneyOutMinor: 1250 },
    ]);
  });

  it("groups spending by type for money that left, excluding transfers", () => {
    expect(
      spendingByType(
        [
          row({ amountMinor: 1000 }),
          row({ amountMinor: 400, transactionType: "OTHER" }),
          row({ amountMinor: 5000, transactionType: "TRANSFER" }),
          row({ amountMinor: 250, direction: "IN", transactionType: "INCOME" }),
        ],
        "MYR",
      ),
    ).toEqual([
      { transactionType: "EXPENSE", amountMinor: 1000 },
      { transactionType: "OTHER", amountMinor: 400 },
    ]);
  });

  it("includes rows that still need review when asked, and still omits repayments", () => {
    const points = monthlyCashFlow(
      [
        row({ status: "PENDING_REVIEW", amountMinor: 1500 }),
        row({ status: "PENDING_REVIEW", amountMinor: 161677, direction: "IN", transactionType: "REPAYMENT" }),
      ],
      "MYR",
      { includeNeedsReview: true },
    );
    expect(points).toEqual([{ month: "2026-11", moneyInMinor: 0, moneyOutMinor: 1500 }]);
  });

  it("prefers MYR when more than one currency has chartable rows", () => {
    expect(chartCurrencies([row({ currency: "SGD" }), row()])).toEqual(["MYR", "SGD"]);
  });
});
