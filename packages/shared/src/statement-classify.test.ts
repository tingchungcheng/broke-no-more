import { describe, expect, it } from "vitest";
import { reconcileStatementRow } from "./statement-classify";

describe("statement row type", () => {
  it("keeps a card payment as a repayment even when the model calls it income", () => {
    expect(
      reconcileStatementRow({
        description: "PAYMENT THANK YOU - IB",
        direction: "IN",
        transactionType: "INCOME",
        suggestion: { direction: "IN", transactionType: "INCOME" },
      }),
    ).toEqual({ direction: "IN", transactionType: "REPAYMENT" });
  });

  it("does not treat a merchant repayment as a payment onto the card", () => {
    expect(
      reconcileStatementRow({
        description: "SPAYLATER REPAYMENT-EC S KUALA LUMPUR",
        direction: "IN",
        transactionType: "REPAYMENT",
        accountType: "CREDIT_CARD",
        suggestion: { direction: "IN", transactionType: "REPAYMENT" },
      }),
    ).toEqual({ direction: "OUT", transactionType: "EXPENSE" });
  });

  it("lets the model mark a card charge as spending", () => {
    expect(
      reconcileStatementRow({
        description: "SPAYLATER REPAYMENT-EC S KUALA LUMPUR",
        direction: "IN",
        transactionType: "INCOME",
        suggestion: { direction: "OUT", transactionType: "EXPENSE" },
      }),
    ).toEqual({ direction: "OUT", transactionType: "EXPENSE" });
  });

  it("keeps the parsed row when the suggestion disagrees with itself", () => {
    expect(
      reconcileStatementRow({
        description: "Salary",
        direction: "IN",
        transactionType: "INCOME",
        suggestion: { direction: "OUT", transactionType: "INCOME" },
      }),
    ).toEqual({ direction: "IN", transactionType: "INCOME" });
  });
});
