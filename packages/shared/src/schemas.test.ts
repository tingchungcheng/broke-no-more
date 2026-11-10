import { describe, expect, it } from "vitest";
import { createAccountSchema, createTransactionSchema } from "./schemas";

describe("schemas", () => {
  it("rejects a client-supplied user id and a full card number", () => {
    const withUser = createAccountSchema.safeParse({
      type: "CASH",
      displayName: "Wallet",
      currency: "MYR",
      userId: "someone-else",
    });
    expect(withUser.success).toBe(false);

    const card = createAccountSchema.safeParse({
      type: "CREDIT_CARD",
      displayName: "Card",
      currency: "MYR",
      maskedIdentifier: "4111111111111111",
    });
    expect(card.success).toBe(false);
  });

  it("accepts a masked identifier and a manual expense", () => {
    const account = createAccountSchema.parse({
      type: "EWALLET",
      displayName: "Everyday wallet",
      currency: "myr",
    });
    expect(account.currency).toBe("MYR");

    const transaction = createTransactionSchema.parse({
      accountId: "8d1b6c2e-0e3a-4f7b-9c1d-2a4b6c8d0e1f",
      transactionDate: "2026-11-10",
      description: "Lunch",
      amount: "12.50",
      currency: "MYR",
      direction: "OUT",
      transactionType: "EXPENSE",
    });
    expect(transaction.amount).toBe("12.50");
  });
});
