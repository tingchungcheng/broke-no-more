-- Phase 0 ledger schema for PostgreSQL. Keep this file in sync with packages/database/src/schema.ts.
-- Amounts are integer minor units. Currency is always stored beside the amount.

CREATE TABLE users (
  id TEXT PRIMARY KEY NOT NULL,
  google_sub TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  picture_url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  csrf_token TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX sessions_user_id_idx ON sessions (user_id);

CREATE TABLE oauth_connections (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  status TEXT NOT NULL,
  scopes TEXT,
  encrypted_refresh_token TEXT,
  encryption_key_version TEXT,
  token_expires_at TEXT,
  connected_at TEXT,
  disconnected_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (provider IN ('gmail')),
  CHECK (status IN ('connected', 'disconnected', 'error')),
  UNIQUE (user_id, provider)
);

CREATE TABLE accounts (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  institution TEXT,
  display_name TEXT NOT NULL,
  currency TEXT NOT NULL,
  masked_identifier TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (type IN (
    'BANK_ACCOUNT',
    'SAVINGS_ACCOUNT',
    'CASH',
    'EWALLET',
    'CREDIT_CARD',
    'BROKERAGE',
    'RETIREMENT',
    'LOAN',
    'OTHER_ASSET',
    'OTHER_LIABILITY'
  )),
  CHECK (currency ~ '^[A-Z]{3}$')
);

CREATE INDEX accounts_user_id_idx ON accounts (user_id);

CREATE TABLE categories (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX categories_user_id_idx ON categories (user_id);

CREATE TABLE statements (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
  source TEXT NOT NULL,
  status TEXT NOT NULL,
  checksum TEXT,
  original_filename TEXT,
  storage_key TEXT,
  parser_version TEXT,
  period_start TEXT,
  period_end TEXT,
  error_code TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (source IN ('GMAIL', 'UPLOAD')),
  CHECK (status IN (
    'DISCOVERED',
    'DOWNLOADED',
    'STORED',
    'PARSING',
    'PARSED',
    'NORMALIZED',
    'DEDUPLICATED',
    'CLASSIFIED',
    'REVIEW_REQUIRED',
    'COMPLETED',
    'FAILED'
  ))
);

CREATE INDEX statements_user_id_idx ON statements (user_id);
CREATE UNIQUE INDEX statements_user_checksum_unique ON statements (user_id, checksum);

CREATE TABLE transactions (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  statement_id TEXT REFERENCES statements(id) ON DELETE SET NULL,
  transaction_date TEXT NOT NULL,
  posted_date TEXT,
  description_raw TEXT NOT NULL,
  description_normalized TEXT NOT NULL,
  merchant_name TEXT,
  amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
  currency TEXT NOT NULL,
  direction TEXT NOT NULL,
  transaction_type TEXT NOT NULL,
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  status TEXT NOT NULL,
  confidence REAL,
  source TEXT NOT NULL,
  source_reference TEXT,
  parser_version TEXT,
  fingerprint TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (currency ~ '^[A-Z]{3}$'),
  CHECK (direction IN ('IN', 'OUT')),
  CHECK (transaction_type IN ('EXPENSE', 'INCOME', 'TRANSFER', 'REFUND', 'REPAYMENT', 'INVESTMENT', 'OTHER')),
  CHECK (status IN ('PENDING_REVIEW', 'CONFIRMED', 'EXCLUDED')),
  CHECK (source IN ('MANUAL', 'STATEMENT'))
);

CREATE INDEX transactions_user_id_idx ON transactions (user_id);
CREATE INDEX transactions_account_id_idx ON transactions (account_id);

CREATE TABLE sync_jobs (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  checkpoint TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  error_code TEXT,
  started_at TEXT,
  finished_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (status IN ('pending', 'running', 'succeeded', 'failed'))
);

CREATE INDEX sync_jobs_user_id_idx ON sync_jobs (user_id);
