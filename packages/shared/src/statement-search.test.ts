import { describe, expect, it } from "vitest";
import {
  messageIsStatement,
  MAX_ACCOUNT_STATEMENT_KEYWORDS,
  normalizeAccountStatementKeywords,
  normalizeStatementKeywords,
  rankStatementAccounts,
  receivedOnInMalaysia,
  statementSearchQuery,
  validateStatementScanRange,
} from "./statement-search";

describe("statement keyword search", () => {
  it("keeps a short list of plain phrases", () => {
    expect(normalizeStatementKeywords(["  hong   leong ", "RYT", "ryt", "subject:bank", "a", "Moomoo"])).toEqual([
      "hong leong",
      "RYT",
      "Moomoo",
    ]);
  });

  it("caps account scan keywords", () => {
    expect(MAX_ACCOUNT_STATEMENT_KEYWORDS).toBe(3);
    expect(normalizeAccountStatementKeywords(["Hong Leong", "credit card", "HLB", "extra"])).toEqual([
      "Hong Leong",
      "credit card",
      "HLB",
    ]);
  });

  it("picks the account whose phrases appear in the email subject", () => {
    const card = "card-account";
    const savings = "savings-account";
    const ranked = rankStatementAccounts("Your Hong Leong Credit Card e-Statement", [
      { label: "Hong Leong", accountId: card },
      { label: "credit card", accountId: card },
      { label: "Hong Leong", accountId: savings },
      { label: "savings", accountId: savings },
    ]);
    expect(ranked[0]).toMatchObject({ accountId: card, matchedLabels: ["Hong Leong", "credit card"] });
    expect(ranked[1]).toMatchObject({ accountId: savings, matchedLabels: ["Hong Leong"] });
    expect(rankStatementAccounts("Maybank e-Statement", [{ label: "Hong Leong", accountId: card }])).toEqual([]);
  });

  it("requires statement language in the Gmail query and quotes each keyword", () => {
    const query = statementSearchQuery(["Hong Leong", "RYT"], { fromDate: "2026-11-01", toDate: "2026-11-30" });
    expect(query).toContain("subject:statement");
    expect(query).toContain("subject:e-statement");
    expect(query).toContain('"Hong Leong"');
    expect(query).toContain('"RYT"');
    expect(query).toContain("after:2026/11/01");
    expect(query).toContain("before:2026/12/01");
    expect(query).not.toContain("in:inbox");
  });

  it("rejects scan ranges longer than a year", () => {
    expect(() => validateStatementScanRange("2023-01-01", "2026-11-10")).toThrow(/366/);
  });

  it("keeps statement subjects that match a chosen keyword and drops everything else", () => {
    expect(
      messageIsStatement({
        subject: "Your Hong Leong e-Statement for October",
        from: "notices@example.com",
        keywords: ["Hong Leong"],
      }).keep,
    ).toBe(true);
    expect(
      messageIsStatement({
        subject: "Your monthly statement",
        from: "Moomoo <mail@example.com>",
        keywords: ["Moomoo"],
      }).matched,
    ).toEqual(["Moomoo"]);
    expect(
      messageIsStatement({
        subject: "Hong Leong exclusive promo",
        from: "news@example.com",
        keywords: ["Hong Leong"],
      }).keep,
    ).toBe(false);
    expect(
      messageIsStatement({
        subject: "Hong Leong statement OTP",
        from: "alerts@example.com",
        keywords: ["Hong Leong"],
      }).keep,
    ).toBe(false);
    expect(
      messageIsStatement({
        subject: "Your e-Statement is ready",
        from: "notices@example.com",
        keywords: ["RYT"],
      }).keep,
    ).toBe(false);
    expect(
      messageIsStatement({
        subject: "Cryptocurrency statement",
        from: "desk@example.com",
        keywords: ["ryt"],
      }).keep,
    ).toBe(false);
  });

  it("dates a message in Malaysia", () => {
    expect(receivedOnInMalaysia(Date.UTC(2026, 10, 10, 15, 59))).toBe("2026-11-10");
    expect(receivedOnInMalaysia(Date.UTC(2026, 10, 10, 16, 0))).toBe("2026-11-11");
  });
});
