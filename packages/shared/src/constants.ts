export const ACCOUNT_TYPES = [
  "BANK_ACCOUNT",
  "SAVINGS_ACCOUNT",
  "CASH",
  "EWALLET",
  "CREDIT_CARD",
  "BROKERAGE",
  "RETIREMENT",
  "LOAN",
  "OTHER_ASSET",
  "OTHER_LIABILITY",
] as const;

export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const DIRECTIONS = ["IN", "OUT"] as const;

export type Direction = (typeof DIRECTIONS)[number];

export const TRANSACTION_TYPES = [
  "EXPENSE",
  "INCOME",
  "TRANSFER",
  "REFUND",
  "REPAYMENT",
  "INVESTMENT",
  "OTHER",
] as const;

export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const TRANSACTION_STATUSES = ["PENDING_REVIEW", "CONFIRMED", "EXCLUDED"] as const;

export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

export const TRANSACTION_SOURCES = ["MANUAL", "STATEMENT"] as const;

export type TransactionSource = (typeof TRANSACTION_SOURCES)[number];

export const STATEMENT_STATUSES = [
  "DISCOVERED",
  "DOWNLOADED",
  "STORED",
  "PARSING",
  "PARSED",
  "NORMALIZED",
  "DEDUPLICATED",
  "CLASSIFIED",
  "REVIEW_REQUIRED",
  "COMPLETED",
  "FAILED",
] as const;

export type StatementStatus = (typeof STATEMENT_STATUSES)[number];

export const STATEMENT_SOURCES = ["GMAIL", "UPLOAD"] as const;

export type StatementSource = (typeof STATEMENT_SOURCES)[number];
