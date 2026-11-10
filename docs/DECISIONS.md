# Decisions

## 2026-11-10 — Charts use confirmed cash flow, not net worth

Context: the overview had counts and a recent list, and net worth must stay uncalculated until statement balances exist.

Decision: the dashboard charts confirmed income, expenses, refunds, investments, and other rows by currency. Transfers and repayments are omitted so they are not drawn as spending. Pending and excluded rows are omitted. Currencies are never added together.

Consequences: a chart can appear from manual records. It is not a balance or a net-worth series.

## 2026-11-10 — Phase 0 only

Context: the architecture says to implement one phase at a time and to start with Phase 0.

Decision: this change builds the monorepo, Google sign-in, session, schema, and a shell that can create and read the signed-in user's accounts and transactions. Gmail connect, parsing, and the financial engine are not included. Net worth is shown as "Not calculated".

Consequences: the product can be signed into and can hold manual records. It cannot import a statement yet.

## 2026-11-10 — Money is an unsigned minor amount plus a direction

Context: the architecture requires integer minor units and one consistent sign convention.

Decision: `amount_minor` is always `>= 0`. `direction` is `IN` or `OUT`. Expenses must be out, income and refunds must be in. Currencies are never added together implicitly.

Consequences: displays say "In" or "Out" in text as well as showing the amount. A later engine can sum by currency without guessing a sign.

## 2026-11-10 — Sessions table

Context: the entity list did not include sessions, and secure sign-in needs a revocable server-side session.

Decision: add `sessions` with a hashed token and a csrf token. The browser receives only the raw session token in an HttpOnly cookie.

Consequences: logout deletes the row. A database read of session rows does not reveal a usable cookie.

## 2026-11-10 — Categories table, validation package omitted

Context: transactions reference `category_id`, and the suggested repo layout also has `packages/validation`.

Decision: add an empty `categories` table so the foreign key is real. Put Zod schemas in `packages/shared` and do not add a second validation package.

Consequences: no category taxonomy is invented. Classification can fill the table later.

## 2026-11-10 — Manual rows are confirmed and unfingerprinted

Context: Phase 0 needs a way to create the user's own records before statement import exists.

Decision: a transaction the user submits is `source=MANUAL` and `status=CONFIRMED`. The UI calls that "Recorded by you". No fingerprint is stored, so repeated purchases are kept. Statement matching states from the architecture are not columns yet.

Consequences: these rows are not claimed to be statement-verified. Dedup and match review arrive with later phases.

## 2026-11-10 — Dev personas for local tenant checks

Context: Google credentials may be absent, and the exit criteria still require two users who cannot read each other.

Decision: `POST /auth/dev-login` accepts only `alex` or `blair`, and only when the environment is `development` or `test` and the flag is true. Subjects are `dev:alex` and `dev:blair`.

Consequences: production config that leaves the flag on still returns 404. The personas are not a Gmail connection.

## 2026-11-10 — AWS instead of Cloudflare

Context: the first scaffold followed the architecture's Workers, D1, and R2 choices. The product owner asked to use an existing AWS account, with Cognito and Lambda.

Decision: Phase 0 runs as a Node Hono service with a Lambda handler, PostgreSQL, and Cognito hosted UI for Google sign-in. Direct Google OIDC remains for environments without a user pool. S3 and EventBridge replace R2 and cron in later phases. OpenAI is an unused env slot until classification exists. The stable id from Cognito is stored as `cognito:<sub>` so it cannot collide with a raw Google subject.

Consequences: local development uses Docker Postgres. Creating the Cognito user pool needs AWS credentials on this machine. A console login in the browser is not those credentials. Dev personas still cover tenant tests.

## 2026-11-10 — Same-origin cookies via the Vite proxy

Context: a split localhost port would drop the OAuth state cookie on the way back from Google.

Decision: the browser talks only to `http://localhost:5173`. Vite proxies `/api` to the Node API on port 8787. `PUBLIC_APP_URL` is that browser origin. Cognito's callback is `http://localhost:5173/api/v1/auth/cognito/callback`. Direct Google uses `http://localhost:5173/api/v1/auth/google/callback`.

Consequences: Google Cloud must allow `http://localhost:5173/api/v1/auth/google/callback`. Production should also be one origin.
