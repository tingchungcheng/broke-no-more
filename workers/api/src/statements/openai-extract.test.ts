import { describe, expect, it } from "vitest";
import { applyModelClassifications, transactionsFromModelJson } from "./openai-extract";

describe("OpenAI statement extraction", () => {
  it("keeps dated rows and drops invented blanks", () => {
    const parsed = transactionsFromModelJson({
      transactions: [
        { date: "03/11/2026", description: "AEON", amount: "1,234.50", currency: "MYR", direction: "OUT" },
        { date: "not-a-date", description: "skip", amount: "1.00", direction: "IN" },
      ],
    });
    expect(parsed?.parserVersion).toBe("openai-extract-v1");
    expect(parsed?.transactions).toEqual([
      {
        transactionDate: "2026-11-03",
        description: "AEON",
        amountMinor: 123450,
        currency: "MYR",
        direction: "OUT",
        transactionType: "EXPENSE",
      },
    ]);
  });

  it("turns a card payment into a repayment and keeps a charge as spending", () => {
    const rows = applyModelClassifications(
      [
        {
          transactionDate: "2026-10-03",
          description: "PAYMENT THANK YOU - IB",
          amountMinor: 161677,
          currency: "MYR",
          direction: "IN" as const,
          transactionType: "INCOME" as const,
        },
        {
          transactionDate: "2026-10-20",
          description: "SPAYLATER REPAYMENT-EC",
          amountMinor: 2000,
          currency: "MYR",
          direction: "IN" as const,
          transactionType: "INCOME" as const,
        },
      ],
      {
        rows: [
          { index: 0, direction: "IN", transactionType: "INCOME" },
          { index: 1, direction: "OUT", transactionType: "EXPENSE" },
        ],
      },
    );
    expect(rows.map((row) => [row.description, row.direction, row.transactionType])).toEqual([
      ["PAYMENT THANK YOU - IB", "IN", "REPAYMENT"],
      ["SPAYLATER REPAYMENT-EC", "OUT", "EXPENSE"],
    ]);
  });

  it("returns nothing when the model sees no rows", () => {
    expect(transactionsFromModelJson({ transactions: [] })).toBeNull();
    expect(transactionsFromModelJson({})).toBeNull();
  });
});
