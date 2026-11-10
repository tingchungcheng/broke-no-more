# Broke No More --- System Architecture

> **Purpose:** This document is the source of truth for the initial
> architecture of Broke No More. It is intended to be shared with Grokbot,
> Cursor, and other coding agents.
>
> **Product positioning:** An AI-powered personal finance intelligence
> platform that converts financial statements and financial emails into
> a unified, reviewable financial ledger.
>
> **Status:** MVP architecture / living document\
> **Initial market:** Malaysia\
> **Primary currency:** MYR (multi-currency capable)\
> **Architecture principle:** Build a reliable financial data pipeline
> first; add AI as an assistive layer, not as the source of financial
> truth.

---

## 1. Product definition

Broke No More is a personal finance platform for users who want a
consolidated view of their money without manually recording every
transaction or connecting every bank individually.

A user signs in with Google and may separately authorize Broke No More to
read financial statements and notifications from one Gmail mailbox.
Broke No More discovers statements from multiple financial institutions in
that mailbox, imports them, extracts transactions, categorizes them, and
presents a unified financial dashboard.

### 1.1 Core product rule

**One Google identity = one Broke No More user = one unified personal finance
workspace.**

- One user can have many financial institutions and accounts.
- One Gmail mailbox is the initial ingestion source for that user.
- Users do not need to connect each bank individually.
- Users can manually upload statements when email ingestion is
  unavailable.
- Google sign-in and Gmail access are separate permissions and
  separate OAuth concerns.

### 1.2 What Broke No More is --- and is not

Broke No More is: - A unified financial ledger across bank accounts, credit
cards, e-wallets, investments, and liabilities. - A statement ingestion
and transaction normalization system. - A cash-flow, spending,
recurring-payment, and net-worth analytics platform. - An assistive
financial intelligence layer that explains patterns using verified
ledger data.

Broke No More is not initially: - A banking app or payment processor. - A
system that can move money or initiate transfers. - A live open-banking
aggregator. - A tax, investment, or financial-advice service. - A
chatbot that guesses balances or calculates finances from unverified
text.

### 1.3 MVP success criteria

A user should be able to: 1. Sign in using Google. 2. Explicitly connect
Gmail using a separate consent flow. 3. Discover and import supported
statement attachments from that mailbox. 4. Upload a statement manually
if automatic discovery fails. 5. Review parsed transactions and correct
categories/accounts. 6. See consolidated monthly income, expenses,
transfers, liabilities, and account balances. 7. Understand how each
displayed number was derived and trace it back to its source statement.

---

## 2. Guiding principles

1.  **Financial correctness over AI novelty.** Deterministic code owns
    arithmetic, balances, deduplication, and reconciliation.
2.  **Human review for uncertain data.** Low-confidence parsing or
    categorization must enter a review queue.
3.  **Idempotent ingestion.** Reprocessing the same email or file must
    not create duplicate statements or transactions.
4.  **Traceability.** Every imported transaction must retain provenance
    to its statement, source file, and parser version.
5.  **Privacy by design.** Request the minimum scopes, encrypt tokens,
    isolate tenants, and provide disconnect/deletion controls.
6.  **MY-first, multi-currency-ready.** Model currencies explicitly;
    never silently mix currencies.
7.  **Incremental delivery.** Build and test one phase at a time. Do not
    implement the entire roadmap in one coding-agent run.
8.  **No fake integrations.** Do not invent bank sender addresses,
    statement formats, APIs, or supported institutions. Verify using
    real test samples.

---

## 3. High-level architecture

```text
                         ┌─────────────────────────┐
                         │       User / Browser    │
                         └────────────┬────────────┘
                                      │
                         ┌────────────▼────────────┐
                         │ Vite + React + TypeScript│
                         │ Dashboard / Review UI   │
                         └────────────┬────────────┘
                                      │ HTTPS / JSON
                         ┌────────────▼────────────┐
                         │ AWS Lambda + Hono API   │
                         │ Cognito session adapter │
                         └──────┬─────────┬────────┘
                                │         │
                      ┌─────────▼──┐  ┌───▼────────────┐
                      │ PostgreSQL │  │ Amazon S3      │
                      │ + Drizzle  │  │ Private files  │
                      └────────────┘  └────────────────┘
                                │
                      ┌─────────▼─────────┐
                      │ Ingestion / Jobs  │
                      │ Gmail + Upload    │
                      └──────┬────────────┘
                             │
               ┌─────────────▼────────────────┐
               │ Statement Processing Pipeline│
               │ Detect → Store → Parse       │
               │ Normalize → Deduplicate     │
               │ Classify → Review / Post    │
               └─────────────┬────────────────┘
                             │
                 ┌───────────▼───────────┐
                 │ Financial Engine      │
                 │ Ledger / Reconcile    │
                 │ Cash flow / Net worth │
                 └───────────┬───────────┘
                             │
                    ┌────────▼────────┐
                    │ OpenAI API      │
                    │ Optional assist │
                    └─────────────────┘
```

### 3.1 Initial technology choices

---

Layer Initial choice Responsibility

---

Frontend Vite, React, TypeScript Web application

UI Tailwind CSS, shadcn/ui Design system and
components

Charts Recharts Financial
visualizations

Client data TanStack Query API state and caching

Routing React Router Application routes

Validation Zod Shared request and data
validation

API AWS Lambda + Hono Backend API and
lightweight jobs

Database PostgreSQL + Drizzle Relational financial
ORM data

File storage Amazon S3 Private statement
storage

Scheduling EventBridge Periodic Gmail sync
Scheduler

Authentication Cognito Google User identity
IdP + HttpOnly session

Email ingestion Gmail API Statement discovery and
download

AI OpenAI API Classification fallback
and explanations

Testing Vitest Unit and integration
tests

---

Use current stable package versions at implementation time. Do not
assume a specific package version without checking compatibility.

### 3.2 Why relational storage

Financial records have relationships: transactions belong to accounts
and statements; transfers connect two ledger entries; repayments settle
liabilities; refunds relate to purchases. SQL is a natural fit for these
queries and constraints.

PostgreSQL is the database. Local development uses Docker. Production
uses a managed PostgreSQL instance. Keep database access behind
repository boundaries.

### 3.3 Processing constraints

The API is a Hono app on AWS Lambda. Complex PDF parsing, OCR, or large
documents may exceed the function timeout or memory limit.

- Start with text-based PDFs and CSV/XLSX formats that can be
  processed reliably within platform limits.
- Keep parsers behind a `StatementParser` interface.
- If complex PDF/OCR processing becomes necessary, move that work to a
  dedicated processing service or queue consumer.
- Do not introduce an always-on EC2 instance for the MVP without a
  demonstrated need.

---

## 4. Authentication and Gmail authorization

This is a critical security and product boundary.

### 4.1 Google sign-in

Use Google OpenID Connect for authentication with the minimum identity
scopes: - `openid` - `email` - `profile`

Use Google's stable `sub` claim as the external identity key. Do not use
email as the primary identity key because email addresses can change.

On successful login: 1. Validate the OIDC response and state. 2. Find or
create the Broke No More user using `google_sub`. 3. Create a secure
application session. 4. Return only the minimum user profile to the
frontend.

### 4.2 Gmail connection is a separate flow

Google sign-in does **not** grant permission to read Gmail.

When a user clicks **Connect Gmail**: 1. Start a separate OAuth
authorization flow. 2. Request the narrowest scope that supports the
feature. The initial statement-ingestion design may require
`https://www.googleapis.com/auth/gmail.readonly`. 3. Use state
validation and PKCE where supported and appropriate. 4. Validate the
callback and exchange the authorization code on the server. 5. Encrypt
and store refresh tokens server-side. 6. Never expose refresh tokens or
access tokens to browser JavaScript. 7. Provide a clear
disconnect/revoke action.

Do not request Gmail scopes during ordinary sign-in. Do not imply that
SSO alone allows inbox access.

### 4.3 Google verification and restricted-scope risk

`gmail.readonly` is a restricted Gmail scope. A public SaaS that
accesses, stores, or transmits Gmail data may be subject to Google's
OAuth verification requirements and potentially an independent security
assessment.

Before public launch: - Review Google's current Gmail API
restricted-scope and verification policies. - Prepare a privacy policy
and terms of service. - Explain exactly what data is accessed and why. -
Implement deletion, retention, consent, disconnect, and access
controls. - Avoid sending unnecessary email content to third-party AI
services. - Consider manual statement upload and user-forwarded-email
ingestion as fallback product paths.

Do not promise that production Gmail access will work for every user
until verification and policy requirements have been confirmed.

### 4.4 Session and token security

- Use secure, HttpOnly, SameSite cookies for the application session.
- Enforce HTTPS.
- Protect state-changing requests against CSRF.
- Encrypt OAuth refresh tokens at rest using a managed secret/key
  strategy.
- Keep secrets in Cloudflare environment secrets, never in source
  control.
- Never log OAuth codes, access tokens, refresh tokens, statement
  contents, or full account numbers.
- Apply authorization checks on every user-owned resource.

---

## 5. Gmail ingestion and statement discovery

### 5.1 Initial sync model

Use scheduled polling initially. Gmail push notifications can be
evaluated later.

A daily scheduled sync is sufficient for monthly statements in the MVP.
Provide a manual **Sync now** action with sensible rate limits.

### 5.2 Discovery pipeline

```text
Scheduled / Manual Sync
        ↓
Load user's Gmail connection
        ↓
Search messages using provider rules and date/checkpoint
        ↓
Inspect message metadata and attachments
        ↓
Identify likely financial statement
        ↓
Download supported attachment
        ↓
Calculate checksum
        ↓
Store original file in private R2
        ↓
Create statement record
        ↓
Queue processing job
```

Provider detection should be data-driven and configurable. Store
verified sender patterns, subject patterns, attachment extensions, and
institution identifiers as configuration. Do not hardcode guessed sender
addresses.

### 5.3 Sync reliability

Persist: - Last successful sync timestamp. - Gmail history/checkpoint or
equivalent pagination state where applicable. - Message ID and
attachment metadata. - Retry count and last error. - Sync job status.

Handle: - Gmail pagination. - Expired credentials. - Temporary API
failures and rate limits. - Duplicate messages and attachments. -
Partial sync failures. - User disconnects during sync.

A failed message must not cause the entire mailbox sync to fail.

### 5.4 Deduplication

Use stable identifiers wherever available: - Gmail message ID. -
Attachment checksum (for example SHA-256). - Statement identity: user,
institution, account, statement period, and source checksum. -
Transaction identity: source transaction ID if available; otherwise a
carefully designed normalized fingerprint.

A fingerprint may include account, date, amount, currency, normalized
description, and transaction type. Do not rely on amount and date alone
because legitimate repeated purchases can share those values.

---

## 6. Manual transaction entry and statement cross-check

Manual entry is a core feature, not a fallback hidden in settings. A user may record a purchase immediately, then let a future statement validate and enrich that record.

### 6.1 Manual expense flow

The quick-entry form should collect:

- Amount and currency (required).
- Transaction date (required; default to today, editable).
- Payment account / payment app (required or selectable from the user's accounts; examples: Touch 'n Go eWallet, Maybank debit card, HLB credit card, cash).
- Merchant or payee (optional but strongly encouraged).
- Category (optional; can be suggested).
- Note (optional).
- Transaction type (expense by default; allow income, refund, or transfer when appropriate).

Do not confuse the **payment app/account** with the **merchant app**. For example, TNG may be the payment account, while GrabFood is the merchant/service. Model these as separate fields when both are known:

- `account_id` / `payment_source`: where the money was paid from.
- `merchant_name` / `payee`: who received the payment.

The form should be fast: amount, date, and payment account are the minimum useful inputs. Additional fields can be optional or progressively disclosed.

### 6.2 Manual entry lifecycle

Suggested states:

- `MANUAL_UNVERIFIED`: entered by the user, not yet found in a statement.
- `MATCH_SUGGESTED`: one or more imported candidates appear plausible.
- `MATCH_CONFIRMED`: user confirms the imported transaction is the same real-world transaction.
- `MATCH_REJECTED`: user rejects a candidate.
- `VERIFIED_MANUAL`: no statement match is expected or the user confirms the manual record should stand alone.
- `DUPLICATE_REVIEW`: multiple possible matches or conflicting evidence require review.

A manual record remains visible in the ledger while awaiting a statement. Once a match is confirmed, link the records and prevent the expense from being counted twice. Preserve both source records and their audit history; do not destructively delete the manual entry.

### 6.3 Candidate matching logic

When a new statement is parsed, compare imported transactions with unmatched manual entries belonging to the same user.

Use multiple signals:

1. Same payment account / institution / wallet, where known.
2. Same currency.
3. Same amount (strong signal; allow configurable tolerance only where the payment rail can legitimately add fees or rounding).
4. Transaction date close to the manually entered date. Start with a configurable window such as ±1 to ±3 days, because posting dates can differ from purchase dates.
5. Merchant / payee similarity after normalization.
6. Compatible transaction direction and type.
7. Reference ID or other unique source evidence, when available.

Do not match solely because two transactions have the same date and amount. Repeated purchases are common. A candidate score should be explainable and should preserve the individual evidence signals.

### 6.4 Confidence levels and calendar review

Provide a calendar-style reconciliation view, alongside a list view for accessibility and mobile layouts.

Suggested confidence mapping:

- **Green — High confidence:** strong amount, account, date, and/or merchant agreement. Show as a strong suggested match, but still ask the user to confirm.
- **Yellow — Possible match:** some signals agree, but one or more important fields are missing or differ. Ask the user to inspect the details.
- **Red — Low confidence / conflict:** weak evidence, conflicting amount/account/type, or multiple plausible candidates. Do not recommend automatic linking; show the reason or keep it in the unmatched queue.

The UI must include text labels such as “High confidence”, “Possible match”, and “Low confidence” in addition to colors. Do not use color as the only communication method.

Calendar behavior:

- Place the manual entry on its transaction date.
- Show the statement candidate and its posting date when different.
- Selecting a date opens a side panel or detail view with the manual entry, candidate transaction(s), evidence, and actions.
- Allow **Confirm match**, **Not the same transaction**, and **Review later**.
- Show unmatched manual entries and imported transactions separately.
- Provide filters for account/payment app, confidence, status, month, and category.
- On small screens, use a grouped date list rather than forcing a dense calendar grid.

### 6.5 Confirming a match and preventing double counting

When the user confirms a match:

- Create a reconciliation/link record between the manual entry and imported transaction.
- Choose one canonical ledger representation for analytics.
- Retain both original records and their provenance.
- Preserve the manual category/note if the imported record does not contain richer information.
- Prefer verified statement amount/date/account details when appropriate, while preserving the user's original entered values for audit.
- Mark both records as reconciled so they are not counted twice.
- Allow the user to undo the match.

When the user rejects a candidate:

- Store the rejection so the same pair is not repeatedly suggested.
- Keep both transactions independently visible.
- Do not suppress other potential candidates.

Never auto-merge a manual entry with an imported transaction in the initial MVP, even if the score is high. A future opt-in automation may be considered only after matching quality is measured and users explicitly enable it.

### 6.6 Data model additions

Add or adapt:

- `manual_entry` source/type metadata on transactions, or a dedicated `manual_transactions` table if source-specific fields make that cleaner.
- `transaction_matches` table with `user_id`, `manual_transaction_id`, `imported_transaction_id`, `confidence_score`, `confidence_band`, `evidence_json`, `status`, `reviewed_at`, and audit timestamps.
- `match_rejections` or a status/history model to avoid repeatedly suggesting rejected pairs.
- Optional `payment_source_label` when a user enters a payment app/account that has not yet been mapped to a formal account.

Use foreign keys and unique constraints to prevent one imported transaction from being confirmed against multiple manual entries unless a deliberate split-transaction feature is designed later.

### 6.7 Matching tests

Include fixtures for:

- Exact amount/account/date/merchant match.
- Same amount and date but different merchant.
- Same merchant/date but different amount.
- Posting date one or two days after purchase.
- Duplicate same-day purchases at the same merchant.
- TNG top-up versus a TNG purchase.
- Credit-card purchase versus credit-card repayment.
- Refund versus original purchase.
- Multiple plausible candidates.
- User-rejected candidate being suggested again.
- Confirmed match not being double-counted.

## 6. Statement processing pipeline

Use explicit processing states:

```text
DISCOVERED
   ↓
DOWNLOADED
   ↓
STORED
   ↓
PARSING
   ↓
PARSED
   ↓
NORMALIZED
   ↓
DEDUPLICATED
   ↓
CLASSIFIED
   ├──→ REVIEW_REQUIRED
   └──→ COMPLETED
```

Failures should transition to a retryable `FAILED` state with an error
code and diagnostic metadata. Never mark a statement complete before all
required database writes succeed.

### 6.1 Parser interface

All institution-specific parsers must implement a common interface.
Conceptual TypeScript contract:

```ts
export interface StatementParser {
  canParse(input: StatementInput): Promise<boolean>;
  parse(input: StatementInput): Promise<ParsedStatement>;
}

export interface ParsedStatement {
  institution: string;
  account?: ParsedAccount;
  statementPeriod?: {
    startDate?: string;
    endDate?: string;
  };
  openingBalance?: Money;
  closingBalance?: Money;
  transactions: ParsedTransaction[];
  warnings: string[];
}
```

The exact types should be defined in `packages/shared` and validated
with Zod.

### 6.2 Parser strategy

- CSV: use a robust CSV parser and institution-specific column
  mappings.
- XLSX: use a spreadsheet parser with explicit sheet and column
  selection.
- Text PDF: extract text and parse using institution-specific layouts.
- Scanned PDF: defer OCR until there is a reliable processing service.
- Unknown format: mark unsupported and ask the user to upload another
  format or provide a sample.

Do not build one giant parser with many fragile conditional branches.
Use independent parser adapters and fixtures.

### 6.3 Parser quality

Each parser should have: - Sanitized sample fixtures. - Unit tests for
date, amount, debit/credit, currency, balance, and description
extraction. - Tests for negative amounts, refunds, duplicate rows,
missing values, and unusual date formats. - Parser version metadata. -
Warnings for incomplete or ambiguous extraction.

Never silently drop a row that looks like a transaction. Preserve parse
warnings and let the review UI resolve ambiguity.

---

## 7. Canonical financial data model

All financial calculations must use a normalized internal model,
independent of the source institution's wording.

### 7.1 Money representation

Represent money using integer minor units, not floating-point
arithmetic.

Example: - RM532.16 → `amount_minor = 53216` - Currency → `MYR`

Every monetary value must include a currency. Never add amounts in
different currencies without an explicit FX conversion record.

### 7.2 Core entities

Recommended initial tables:

---

Table Purpose

---

`users` Broke No More user and Google identity

`oauth_connections` Gmail authorization and encrypted
credentials

`accounts` Bank, savings, credit card,
e-wallet, brokerage, cash, loan,
and retirement accounts

`statements` Imported statement metadata and
processing status

`transactions` Canonical ledger transactions

`categories` User/system category taxonomy

`merchant_mappings` Normalized merchant and category
rules

`transfers` Matched internal transfers between
accounts

`sync_jobs` Gmail and ingestion job history

`review_queue` Items requiring user confirmation

`budgets` Monthly and category budgets

`liabilities` Loans, credit card obligations, and
instalment plans

`asset_snapshots` Periodic asset and account balance
snapshots

`recurring_expenses` Detected subscriptions and
recurring payments

`fx_rates` Explicit exchange rates and
source/date metadata

`audit_logs` User edits and important system
actions

---

All user-owned rows must include `user_id`. Use foreign keys, indexes,
unique constraints, and tenant-scoped repository methods.

### 7.3 Account types

Initial account types: - `BANK_ACCOUNT` - `SAVINGS_ACCOUNT` - `CASH` -
`EWALLET` - `CREDIT_CARD` - `BROKERAGE` - `RETIREMENT` - `LOAN` -
`OTHER_ASSET` - `OTHER_LIABILITY`

Accounts should also carry institution, display name, currency, and
optional masked identifier. Never store full card numbers or online
banking credentials.

### 7.4 Transaction fields

A canonical transaction should include: - `id` - `user_id` -
`account_id` - `statement_id` (nullable for manual entries) -
`transaction_date` - `posted_date` (optional) - `description_raw` -
`description_normalized` - `merchant_name` (optional) - `amount_minor` -
`currency` - `direction` or signed amount convention (choose one
consistently) - `transaction_type` - `category_id` (nullable until
classified) - `status` (`PENDING_REVIEW`, `CONFIRMED`, `EXCLUDED`) -
`confidence` (optional classification confidence) - `source_reference` -
`parser_version` - `created_at` - `updated_at`

Keep the original description and source reference. Never overwrite
source data when a user corrects a category or merchant.

---

## 8. Financial accounting and reconciliation rules

This section is essential. A dashboard that double-counts transfers or
credit card payments is not trustworthy.

### 8.1 Expenses versus transfers

- A purchase is an expense.
- Moving money between a user's own accounts is a transfer, not an
  expense.
- A credit card repayment is a liability settlement, not a second
  expense.
- A TNG or e-wallet top-up is a transfer from bank to wallet, not an
  expense.
- Spending from the wallet is the expense.
- Buying shares is an asset allocation/investment transaction, not a
  lifestyle expense.
- Selling shares is not ordinary income; record proceeds and
  investment/cost-basis information separately.
- A refund should be linked to the original purchase where possible
  and reduce the relevant expense.

### 8.2 Credit card model

Record the card purchase as the expense. Record the subsequent bank
payment and card-side payment as a matched transfer/settlement pair. Do
not count the repayment as another expense.

Track statement balance, payment due date, minimum payment, and payment
status separately from spending analytics.

### 8.3 Instalments and BNPL

Avoid counting both the original purchase and each repayment as separate
expenses.

The system must represent: - Original purchase amount and date. -
Instalment schedule and outstanding liability. - Payments made against
the liability. - Remaining balance and due dates.

If the source data is insufficient to determine whether a row is a
purchase or repayment, require user review.

### 8.4 Transfers and reconciliation

Transfer matching should consider: - Same user. - Different owned
accounts. - Opposite signed amounts. - Compatible currencies (or
explicit FX conversion). - Dates within a configurable window. -
Descriptions and reference IDs.

A suggested match is not automatically final when confidence is low. Let
users confirm or reject matches.

### 8.5 Balances and net worth

Do not derive net worth by blindly summing all transaction totals.

Prefer verified account balance snapshots from statements or
user-provided values. Define the net worth calculation explicitly:

`Net Worth = Total Assets - Total Liabilities`

Avoid double counting: - Credit card balances are liabilities. - Loan
outstanding balances are liabilities. - Brokerage cash and holdings must
not be counted twice. - EPF/retirement balances should be included only
when supplied or imported and clearly labelled by valuation date. -
Investment values require a price source and timestamp if market-priced.

Display data freshness and missing-account warnings alongside net worth.

---

## 9. Categorization and AI layer

### 9.1 Processing order

1.  Institution parser extracts source fields.
2.  Deterministic normalization cleans descriptions and signs.
3.  Known merchant mappings and user rules run first.
4.  Deterministic heuristics classify obvious cases.
5.  OpenAI is called only for uncertain or ambiguous cases when useful.
6.  Low-confidence results enter the review queue.
7.  User corrections update personal mappings/rules.

### 9.2 AI must not be the financial source of truth

AI may: - Suggest a category. - Normalize a merchant description. -
Explain trends from verified aggregates. - Summarize changes and unusual
spending. - Help users ask questions about their ledger.

AI must not: - Invent transactions or balances. - Calculate
authoritative financial totals. - Decide that a transfer is definitely
an expense without evidence. - silently overwrite user-confirmed
categories. - Receive full statements or personal data unnecessarily.

For AI insights, provide only the minimum necessary structured
aggregates. Validate model output with Zod and treat it as a suggestion.
All calculations must be performed by deterministic application code.

### 9.3 Classification output

Require structured output such as: - `category` - `merchant` -
`transaction_type` - `confidence` - `reason` - `needs_review`

Use a strict schema and reject malformed output. Store model/version
metadata for auditability.

---

## 10. API design

Use versioned routes under `/api/v1`. The following is a proposed
contract, not a requirement to implement every route in the first phase.

### Authentication

- `GET /auth/google`
- `GET /auth/google/callback`
- `POST /auth/logout`
- `GET /auth/me`

### Gmail integration

- `GET /integrations/gmail/status`
- `POST /integrations/gmail/connect`
- `GET /integrations/gmail/callback`
- `POST /integrations/gmail/sync`
- `GET /integrations/gmail/sync-history`
- `DELETE /integrations/gmail`

### Statements

- `POST /statements/upload`
- `GET /statements`
- `GET /statements/:id`
- `POST /statements/:id/reprocess`
- `DELETE /statements/:id`

### Transactions

- `GET /transactions`
- `GET /transactions/:id`
- `PATCH /transactions/:id`
- `POST /transactions/:id/confirm`
- `POST /transactions/:id/exclude`
- `POST /transactions/transfers/match`
- `GET /transactions/summary`

### Accounts and analytics

- `GET /accounts`
- `POST /accounts`
- `PATCH /accounts/:id`
- `GET /analytics/monthly`
- `GET /analytics/categories`
- `GET /analytics/cash-flow`
- `GET /analytics/net-worth`
- `GET /analytics/recurring`

### Budgets and liabilities

- `GET /budgets`
- `POST /budgets`
- `PATCH /budgets/:id`
- `GET /liabilities`
- `POST /liabilities`
- `PATCH /liabilities/:id`

All endpoints must authenticate the user and scope every query by the
authenticated `user_id`. Never trust a `user_id` supplied by the
frontend.

---

## 11. Frontend information architecture

Initial routes:

```text
/
├── /login
├── /onboarding
│   ├── /connect-gmail
│   ├── /sync
│   └── /accounts
├── /dashboard
├── /transactions
├── /quick-add
├── /reconciliation
├── /statements
├── /accounts
├── /budgets
├── /liabilities
├── /insights
└── /settings
    ├── /profile
    ├── /connections
    ├── /privacy
    └── /data
```

### 11.1 MVP dashboard

Prioritize these components: - Total assets, liabilities, and net worth
(with valuation date). - Monthly income versus expenses. - Cash-flow
trend. - Spending by category. - Recent transactions requiring review. -
Upcoming known bills and liabilities. - Account balances and
last-updated timestamps. - Data coverage warnings (missing
statements/accounts).

Do not show a precise net worth figure if the system has incomplete or
stale account data without clearly communicating that limitation.

### 11.2 Transaction review UI

Users must be able to: - Confirm or change category. - Correct merchant
name. - Change account mapping. - Mark a transaction as transfer,
repayment, refund, income, or expense. - Match or unmatch transfer
pairs. - Exclude a duplicate or non-transaction row. - See the original
source statement and raw description.

---

## 12. Privacy, security, and multi-tenancy

Security is a core requirement because Broke No More handles highly sensitive
financial data.

- Every business query must be tenant-scoped.
- Add automated tests proving User A cannot access User B's
  statements, transactions, files, or analytics.
- Store R2 objects in private buckets; serve downloads through
  short-lived authorized URLs or authenticated streaming.
- Validate MIME type, file size, and file extension; do not trust
  client-supplied metadata.
- Use malware scanning or a safe file-processing strategy before
  parsing untrusted uploads.
- Encrypt sensitive credentials and minimize stored personal data.
- Do not store online banking usernames/passwords.
- Do not log raw statement contents or full financial identifiers.
- Add user data export and deletion workflows.
- On Gmail disconnect, revoke/delete credentials as appropriate and
  stop future syncs.
- Define retention rules for original files, extracted data, and logs.
- Use rate limits for authentication, sync, uploads, and AI endpoints.
- Keep secrets out of frontend environment variables and public
  bundles.

---

## 13. Repository structure

Use a TypeScript monorepo:

```text
broke-no-more/
├── apps/
│   └── web/
│       ├── src/
│       │   ├── app/
│       │   ├── components/
│       │   ├── features/
│       │   │   ├── auth/
│       │   │   ├── dashboard/
│       │   │   ├── transactions/
│       │   │   ├── statements/
│       │   │   ├── accounts/
│       │   │   └── settings/
│       │   ├── hooks/
│       │   ├── lib/
│       │   └── routes/
│       └── ...
├── workers/
│   └── api/
│       └── src/
│           ├── routes/
│           ├── middleware/
│           ├── services/
│           ├── repositories/
│           ├── integrations/
│           │   └── gmail/
│           ├── ingestion/
│           ├── jobs/
│           └── index.ts
├── packages/
│   ├── database/
│   │   ├── schema/
│   │   ├── migrations/
│   │   └── src/
│   ├── shared/
│   │   ├── types/
│   │   ├── schemas/
│   │   └── constants/
│   └── validation/
├── docs/
│   ├── ARCHITECTURE.md
│   ├── DATABASE.md
│   ├── API.md
│   ├── SECURITY.md
│   └── DECISIONS.md
├── .env.example
├── package.json
├── pnpm-workspace.yaml
└── README.md
```

Adjust the structure only when there is a clear implementation reason.
Avoid unnecessary abstraction in the first phase.

---

## 14. Environment configuration

Maintain `.env.example` with variable names and safe placeholders only.
Never commit real secrets.

Expected configuration categories: - Google OAuth client ID and
secret, or Cognito user pool, client, and domain. - Application session
secret. - Token encryption key / key reference. - OpenAI API key, unused
until classification exists. - Database URL. - S3 bucket, when statement
storage exists. - Application base URL and allowed redirect URLs.

Keep secrets in environment variables or the platform secret store, never
in source or the frontend. Document local development setup and
production setup separately.

---

## 15. Testing strategy

### Unit tests

- Money arithmetic and currency handling.
- Date and amount parsing.
- Institution parser fixtures.
- Transaction normalization.
- Merchant mapping.
- Categorization rules.
- Transfer matching.
- Credit-card repayment and BNPL logic.
- Deduplication fingerprints.

### Integration tests

- Google authentication callback validation.
- Gmail connection and token refresh using mocks.
- Statement upload and storage.
- Statement processing state transitions.
- Database transaction boundaries.
- Tenant isolation.

### End-to-end tests

- Sign in.
- Connect Gmail (mocked OAuth in CI).
- Import a sample statement.
- Review and confirm transactions.
- Verify dashboard totals against expected fixtures.
- Disconnect Gmail and verify sync stops.

Never use real financial statements in public test fixtures. Sanitize
samples and remove names, account numbers, addresses, and other personal
identifiers.

---

## 16. Delivery roadmap

Implement one phase at a time. Do not ask a coding agent to build every
phase in a single run.

### Phase 0 --- Foundation

- Initialize monorepo and tooling.
- Create Vite React TypeScript frontend.
- Create the Hono API for Node and Lambda.
- Configure local PostgreSQL and Drizzle migrations.
- Add initial schema for users, OAuth connections, accounts,
  statements, transactions, and sync jobs.
- Implement Google OIDC sign-in and secure session.
- Add shared Zod schemas and API error format.
- Add basic authenticated app shell.
- Write setup and architecture docs.
- Add tests and CI checks.

**Exit criteria:** A user can sign in, access a protected dashboard
shell, and create/read only their own test data.

### Phase 1 --- Gmail connection and discovery

- Implement separate Gmail OAuth consent flow.
- Encrypt and store refresh tokens.
- Implement connection status and disconnect.
- Implement Gmail search and attachment discovery.
- Add sync jobs, checkpoints, pagination, retry, and deduplication.
- Store original attachments in private R2.
- Add sync history UI.

**Exit criteria:** A test user can connect a test Gmail account and
discover/store supported sample statement attachments without
duplicates.

### Phase 2 --- Statement parsing and review

- Define parser interface.
- Implement one verified institution parser at a time.
- Start with CSV and a selected text-based PDF format.
- Add manual upload.
- Normalize parsed rows.
- Add transaction review UI.
- Add parser fixtures and tests.

**Exit criteria:** A supported statement imports into canonical
transactions with traceable source data and user review.

### Phase 3 --- Financial engine

- Implement merchant normalization and category rules.
- Add AI classification fallback behind a feature flag.
- Implement transfer detection and review.
- Implement credit-card settlement handling.
- Implement refund and BNPL representation.
- Add monthly cash-flow and spending analytics.
- Add account balance snapshots and net worth with freshness warnings.

**Exit criteria:** Dashboard totals reconcile against known test
fixtures without transfer or repayment double counting.

### Phase 4 --- Personal finance intelligence

- Add recurring payment detection.
- Add budgets and liabilities.
- Add user-facing financial insights based only on verified ledger
  aggregates.
- Add multi-currency conversion with explicit FX metadata.
- Add data export and deletion.
- Improve onboarding and coverage warnings.

**Exit criteria:** A user can understand historical cash flow, recurring
commitments, assets, liabilities, and net worth with clear provenance.

### Phase 5 --- Public SaaS readiness

- Complete Google OAuth verification and any required security
  assessment.
- Review privacy policy and terms.
- Conduct tenant isolation and security testing.
- Add quotas, rate limits, observability, backups, and incident
  procedures.
- Add billing only after product usage and costs are understood.
- Review Cloudflare quotas and move heavy processing to dedicated
  infrastructure if needed.

**Exit criteria:** The service is ready for a controlled public beta
with documented privacy, security, and operational procedures.

---

## 17. Instructions for AI coding agents (Grokbot / Cursor)

Treat this document as the architectural source of truth.

### Required working method

For each task: 1. Read this document and the relevant existing code
before making changes. 2. State the goal and assumptions. 3. Propose a
short implementation plan. 4. List the files that will be created or
modified. 5. Implement only the requested phase or task. 6. Run relevant
tests, lint, and type checks. 7. Report what changed, what passed, what
failed, and any remaining risks. 8. Update documentation when
architecture or API behavior changes.

### Strict rules

- **Do not implement all roadmap phases at once.**
- Start with Phase 0 unless explicitly instructed otherwise.
- Do not silently change the technology stack.
- Do not invent bank integrations, sender addresses, sample statement
  formats, or API behavior.
- Do not put secrets in source code, frontend bundles, logs, or
  committed `.env` files.
- Do not expose Gmail tokens to the frontend.
- Do not treat Google sign-in as Gmail authorization.
- Do not use AI for authoritative arithmetic, balances, or ledger
  posting.
- Do not silently discard uncertain transactions.
- Do not double-count transfers, credit-card repayments, e-wallet
  top-ups, or BNPL repayments as expenses.
- Do not trust a frontend-provided `user_id`.
- Do not implement a feature without tests for its important financial
  or security behavior.
- Prefer small, reviewable changes over broad rewrites.
- If this document conflicts with an existing implementation, explain
  the conflict and propose a migration before changing established
  behavior.

### First task

**Implement Phase 0 only.**

Before coding, inspect the repository and report: - Existing files and
tooling. - Any conflicts with this architecture. - The Phase 0
implementation plan. - Required environment variables and local setup.

Then implement Phase 0, run checks, and provide a concise completion
report. Do not begin Phase 1 without explicit instruction.

---

## 18. Open decisions

These decisions must be revisited with evidence, not guessed:

1.  Which Malaysian institutions and statement formats are supported
    first?
2.  Which exact Gmail search strategy and sender patterns work for each
    institution?
3.  Whether Gmail restricted-scope verification and security assessment
    are feasible for the intended public SaaS model.
4.  Whether statement parsing should remain in Workers or move to a
    dedicated processing service.
5.  Which FX rate provider and licensing/usage terms are appropriate.
6.  Whether investment holdings are imported from statements, broker
    exports, or entered manually.
7.  What data retention period users should be offered.
8.  Which dashboard metrics are reliable when some accounts or
    statements are missing.

Record material architecture decisions in `docs/DECISIONS.md` with date,
context, options, decision, and consequences.

---

## 19. Product north star

Broke No More should help users answer five questions confidently:

1.  **How much money do I have?** --- assets, liabilities, and net
    worth.
2.  **Where did my money go?** --- categorized spending with source
    traceability.
3.  **Where did my money come from?** --- salary, other income, refunds,
    and transfers distinguished correctly.
4.  **What commitments are coming?** --- bills, instalments,
    subscriptions, and debt obligations.
5.  **What should I pay attention to?** --- clear, explainable insights
    grounded in verified financial records.

A beautiful dashboard with incorrect financial logic is a failed
product. Build the ledger and reconciliation engine first; the
intelligence layer comes after the data can be trusted.
