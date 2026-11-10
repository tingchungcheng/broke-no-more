import type { AccountType, Direction, TransactionSource, TransactionStatus, TransactionType } from "./constants";

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  BANK_ACCOUNT: "Bank account",
  SAVINGS_ACCOUNT: "Savings",
  CASH: "Cash",
  EWALLET: "E-wallet",
  CREDIT_CARD: "Credit card",
  BROKERAGE: "Brokerage",
  RETIREMENT: "Retirement",
  LOAN: "Loan",
  OTHER_ASSET: "Other asset",
  OTHER_LIABILITY: "Other liability",
};

export const DIRECTION_LABELS: Record<Direction, string> = {
  IN: "In",
  OUT: "Out",
};

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  EXPENSE: "Expense",
  INCOME: "Income",
  TRANSFER: "Transfer",
  REFUND: "Refund",
  REPAYMENT: "Repayment",
  INVESTMENT: "Investment",
  OTHER: "Other",
};

export const TRANSACTION_STATUS_LABELS: Record<TransactionStatus, string> = {
  PENDING_REVIEW: "Needs review",
  CONFIRMED: "Confirmed",
  EXCLUDED: "Excluded",
};

export const TRANSACTION_SOURCE_LABELS: Record<TransactionSource, string> = {
  MANUAL: "Recorded by you",
  STATEMENT: "Imported statement",
};
