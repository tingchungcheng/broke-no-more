import { describe, expect, it } from "vitest";
import { closingBalanceFromText } from "./statement-balance";

describe("statement closing balance", () => {
  it("uses the total balance and ignores the previous balance", () => {
    const text = [
      "PREVIOUS BALANCE FROM LAST STATEMENT   900.00",
      "PAYMENT THANK YOU - IB   100.00   CR",
      "TOTAL BALANCE   1,616.77",
    ].join("\n");
    expect(closingBalanceFromText(text)).toEqual({ amount: "1616.77" });
  });

  it("returns nothing when the page has no closing balance", () => {
    expect(closingBalanceFromText("Minimum payment 50.00\nCredit limit 8,000.00")).toBeNull();
  });
});
