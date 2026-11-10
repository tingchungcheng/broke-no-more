import { describe, expect, it } from "vitest";
import { parseStatementText } from "./statement-parse";

describe("statement text parser", () => {
  it("reads a csv with dates, descriptions, amounts, and direction", () => {
    const parsed = parseStatementText(
      "statement.csv",
      ["date,description,amount,currency,direction", "2026-11-02,Salary,5000.00,MYR,IN", "03/11/2026,Groceries,\"42.10\",MYR,OUT"].join("\n"),
    );
    expect(parsed?.parserVersion).toBe("csv-columns-v1");
    expect(parsed?.transactions).toEqual([
      {
        transactionDate: "2026-11-02",
        description: "Salary",
        amountMinor: 500000,
        currency: "MYR",
        direction: "IN",
        transactionType: "INCOME",
      },
      {
        transactionDate: "2026-11-03",
        description: "Groceries",
        amountMinor: 4210,
        currency: "MYR",
        direction: "OUT",
        transactionType: "EXPENSE",
      },
    ]);
  });

  it("reads debit and credit columns and skips a row that has both", () => {
    const parsed = parseStatementText(
      "statement.csv",
      ["Date,Description,Debit,Credit", "2026-11-01,Cafe,12.50,", "2026-11-02,Refund,,9.00", "2026-11-03,Both,1.00,2.00"].join("\n"),
    );
    expect(parsed?.transactions.map((row) => [row.description, row.direction, row.amountMinor])).toEqual([
      ["Cafe", "OUT", 1250],
      ["Refund", "IN", 900],
    ]);
    expect(parsed?.warnings).toContain("A row had both a debit and a credit.");
  });

  it("reads one supported text line and ignores prose", () => {
    const parsed = parseStatementText("statement.pdf", "Opening balance\n2026-11-10 Kopi at the stall 12.50\nThank you");
    expect(parsed).toMatchObject({
      parserVersion: "text-line-v1",
      transactions: [{ transactionDate: "2026-11-10", description: "Kopi at the stall", amountMinor: 1250, direction: "OUT" }],
    });
  });

  it("does not invent rows from an unrecognized layout", () => {
    expect(parseStatementText("statement.pdf", "Hong Leong e-Statement\nPage 1 of 4\nAccount 1234")).toBeNull();
  });
});
