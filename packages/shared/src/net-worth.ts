import type { AccountType } from "./constants";

const LIABILITY_TYPES = new Set<AccountType>(["CREDIT_CARD", "LOAN", "OTHER_LIABILITY"]);

export type WorthAccount = {
  id: string;
  type: AccountType;
  currency: string;
  displayName: string;
};

export type WorthSnapshot = {
  accountId: string;
  amountMinor: number;
  asOfDate: string;
};

export type NetWorthResult = {
  currency: string;
  assetsMinor: number;
  liabilitiesMinor: number;
  netMinor: number;
  asOfDate: string | null;
  missingAccounts: { id: string; displayName: string }[];
};

export function netWorthFromSnapshots(
  accounts: readonly WorthAccount[],
  snapshots: readonly WorthSnapshot[],
  currency = "MYR",
): NetWorthResult | null {
  const latest = new Map<string, WorthSnapshot>();
  for (const snapshot of snapshots) {
    const current = latest.get(snapshot.accountId);
    if (!current || snapshot.asOfDate > current.asOfDate) latest.set(snapshot.accountId, snapshot);
  }
  const sameCurrency = accounts.filter((account) => account.currency === currency);
  const included = sameCurrency.filter((account) => latest.has(account.id));
  if (included.length === 0) return null;
  let assetsMinor = 0;
  let liabilitiesMinor = 0;
  let asOfDate: string | null = null;
  for (const account of included) {
    const snapshot = latest.get(account.id);
    if (!snapshot) continue;
    if (LIABILITY_TYPES.has(account.type)) liabilitiesMinor += snapshot.amountMinor;
    else assetsMinor += snapshot.amountMinor;
    if (!asOfDate || snapshot.asOfDate > asOfDate) asOfDate = snapshot.asOfDate;
  }
  return {
    currency,
    assetsMinor,
    liabilitiesMinor,
    netMinor: assetsMinor - liabilitiesMinor,
    asOfDate,
    missingAccounts: sameCurrency
      .filter((account) => !latest.has(account.id))
      .map((account) => ({ id: account.id, displayName: account.displayName })),
  };
}
