# Transaction Confidence Architecture

## 1. Objective

Build a Transaction Reconciliation Engine that compares Gmail-imported transactions with manually entered expenses.

The goal is to determine transaction confidence using deterministic matching rules, evidence scoring and conflict detection.

**Core principle:** LLM extracts data; the matching engine determines confidence.

## 2. Architecture

```text
React Native App
       |
    FastAPI
       |
  +----+----------------+
  |                     |
Gmail Ingestion     Manual Input
  |                     |
Email Parser        User Transaction
  |                     |
  +----------+----------+
             |
    Data Normalization
             |
  Transaction Matching
             |
    Confidence Scoring
             |
   Conflict Detection
             |
       PostgreSQL
             |
    Confidence Calendar
```

## 3. Matching Pipeline

### Step 1 — Data Extraction

Extract from Gmail:

- Transaction date
- Amount
- Merchant
- Payment method
- Reference ID
- Email ID

### Step 2 — Normalization

Standardize:

- Merchant names
- Currency (MYR)
- Date and timezone
- Payment method
- Amount precision

### Step 3 — Candidate Matching

Find possible matches using:

- Same or similar amount
- Date proximity (e.g. ±1 day)
- Merchant similarity
- Same payment method
- Reference ID

### Step 4 — Confidence Scoring

Example weighted scoring model:

| Matching criteria   |  Weight |
| ------------------- | ------: |
| Exact amount        |      35 |
| Date proximity      |      20 |
| Merchant similarity |      20 |
| Payment method      |      10 |
| Reference ID        |      15 |
| **Total**           | **100** |

Scores are illustrative and should be calibrated against real transaction data.

Important rules:

- Exact reference ID match provides strong evidence.
- Amount mismatch creates a conflict flag.
- Missing evidence should not automatically mean fraud.
- Multiple possible matches require manual review.
- Never let an LLM arbitrarily assign the final score.

## 4. Confidence Classification

| Score                 | Status          | Calendar |
| --------------------- | --------------- | -------- |
| 85–100                | High confidence | Green    |
| 50–84                 | Needs review    | Yellow   |
| 0–49                  | Unverified      | Grey     |
| Any critical conflict | Conflict        | Red      |

A critical conflict overrides the numerical score.

## 5. PostgreSQL Schema

Suggested tables:

| Table                | Purpose                       |
| -------------------- | ----------------------------- |
| users                | User accounts                 |
| connected_accounts   | Gmail OAuth connections       |
| imported_emails      | Original email metadata       |
| transactions         | Normalized transactions       |
| transaction_evidence | Source and extracted evidence |
| transaction_matches  | Matching relationships        |
| confidence_history   | Score and status history      |

Keep manual and imported records separate, linked through `transaction_matches`.

This prevents duplicate expense calculations and preserves auditability.

## 6. Recommended Tech Stack

| Component         | Technology                |
| ----------------- | ------------------------- |
| Mobile            | React Native + TypeScript |
| Backend           | FastAPI                   |
| Database          | PostgreSQL                |
| Background Jobs   | Celery / Redis            |
| Email Integration | Gmail API + OAuth 2.0     |
| Extraction        | Python + LLM              |
| Infrastructure    | Docker Compose            |

## 7. Important Considerations

- Gmail ingestion must be idempotent (never import the same email twice).
- Store evidence for every matching decision.
- Allow users to manually confirm or reject matches.
- Never count matched manual and imported records twice.
- Support transaction updates and confidence recalculation.
- Encrypt sensitive financial data and protect OAuth tokens.

## 8. MVP Development Phases

1. Manual expense input + PostgreSQL.
2. Gmail OAuth integration.
3. Email parsing and transaction extraction.
4. Deterministic matching and confidence scoring.
5. Calendar visualization.
6. Manual review and correction workflow.

**Product philosophy:**

The system should not simply tell users what they spent. It should show users how confident it is about their financial records, why it believes so, and what still needs verification.
