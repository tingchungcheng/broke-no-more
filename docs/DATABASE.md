# Database

PostgreSQL, accessed through Drizzle. Local development runs Postgres in Docker. The migration is [../packages/database/migrations/0001_phase0.sql](../packages/database/migrations/0001_phase0.sql). The Drizzle tables in [../packages/database/src/schema.ts](../packages/database/src/schema.ts) must stay aligned with that file.

## Money

Amounts are non-negative integers in minor units, always with an ISO currency. MYR uses 2 decimal places: `532.16` becomes `53216`. Direction is stored separately as `IN` or `OUT`. Code refuses to add two amounts when their currencies differ.

## Tables

| Table | Phase 0 role |
| --- | --- |
| `users` | One person, keyed by Google `sub` (or a `dev:` subject for local personas) |
| `sessions` | Hashed session token, csrf token, expiry. Added so a session can be revoked |
| `oauth_connections` | Reserved for a later Gmail grant. Empty in Phase 0 |
| `accounts` | Accounts the user creates |
| `categories` | Empty. Present so `transactions.category_id` has a foreign key |
| `statements` | Empty until import exists. Reads are tenant-scoped |
| `transactions` | Manual rows in Phase 0. `source` is `MANUAL` and `status` is `CONFIRMED` because the user typed them |
| `sync_jobs` | Empty until Gmail sync exists. Reads are tenant-scoped |

Every user-owned row has `user_id`. Repositories filter on the session user. SQLite foreign keys are part of the migration; the test database turns them on explicitly.

Manual rows do not get a fingerprint, so two identical purchases can both exist. Statement deduplication is a later phase.

Email is not unique. Google `sub` is the identity key.
