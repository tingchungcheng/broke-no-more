# Architecture pointer

The source of truth is [../ideas-architectures/architecture.md](../ideas-architectures/architecture.md).

This repository currently implements **Phase 0** only:

- pnpm workspace with `apps/web`, `workers/api`, `packages/shared`, and `packages/database`
- Vite + React + TypeScript, Tailwind, and a small shadcn-style component set
- Hono on Node for local development, with a Lambda handler for AWS
- PostgreSQL schema and a SQL migration for users, sessions, OAuth connections, accounts, categories, statements, transactions, and sync jobs
- Cognito hosted UI or direct Google OIDC for sign-in, then an HttpOnly session
- Shared Zod schemas and one JSON error shape
- An authenticated shell for accounts and manually recorded transactions

Gmail connect, statement parsing, categorization, and the financial engine are later phases. Do not treat the overview page as a net-worth calculation.
