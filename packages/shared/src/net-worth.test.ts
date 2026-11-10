import { describe, expect, it } from "vitest";
import { netWorthFromSnapshots } from "./net-worth";

describe("net worth", () => {
  it("subtracts the latest card balance from assets and names accounts with no balance", () => {
    const result = netWorthFromSnapshots(
      [
        { id: "savings", type: "SAVINGS_ACCOUNT", currency: "MYR", displayName: "Savings" },
        { id: "card", type: "CREDIT_CARD", currency: "MYR", displayName: "Card" },
        { id: "cash", type: "CASH", currency: "MYR", displayName: "Wallet" },
      ],
      [
        { accountId: "savings", amountMinor: 500000, asOfDate: "2026-10-31" },
        { accountId: "card", amountMinor: 100000, asOfDate: "2026-09-30" },
        { accountId: "card", amountMinor: 161677, asOfDate: "2026-10-31" },
      ],
    );
    expect(result).toMatchObject({
      assetsMinor: 500000,
      liabilitiesMinor: 161677,
      netMinor: 338323,
      asOfDate: "2026-10-31",
      missingAccounts: [{ id: "cash", displayName: "Wallet" }],
    });
  });

  it("stays empty until at least one balance exists", () => {
    expect(netWorthFromSnapshots([{ id: "card", type: "CREDIT_CARD", currency: "MYR", displayName: "Card" }], [])).toBeNull();
  });
});
