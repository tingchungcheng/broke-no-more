import { describe, expect, it } from "vitest";
import { transactionsFromModelJson } from "./openai-extract";

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

  it("returns nothing when the model sees no rows", () => {
    expect(transactionsFromModelJson({ transactions: [] })).toBeNull();
    expect(transactionsFromModelJson({})).toBeNull();
  });
});
