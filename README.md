# Broke No More

Personal finance ledger for one Google identity and one private workspace. This repository is **Phase 0**: sign-in, a session, and accounts and transactions that only their owner can read.

The product architecture lives in [ideas-architectures/architecture.md](ideas-architectures/architecture.md). Phase 1 (Gmail connect and statement discovery) is not started.

## What you can do

- Sign in with Google using only `openid`, `email`, and `profile`. That does not grant inbox access.
- On a local machine, sign in as Alex Tan or Blair Lim when dev sign-in is enabled.
- Add accounts and record transactions in integer minor units (RM 12.50 is stored as `1250` MYR).
- See an overview that leaves net worth blank until a real balance exists.

## Local setup

Requirements: Node.js 22 or newer, and pnpm (via Corepack).

```powershell
corepack enable
corepack pnpm install
Copy-Item workers\api\.env.example workers\api\.env
pnpm db:up
pnpm db:migrate
pnpm dev
```

Open http://localhost:5173. The Vite app proxies `/api` to the API on port 8787, so the session cookie stays on one origin.

`workers/api/.env` is gitignored. Add `OPENAI_API_KEY` there when you have one. Phase 0 does not read it. The example session secret is for your machine only. Production refuses that secret and refuses dev sign-in.

The browser console login on AWS is not available to this repo. Cognito setup needs the AWS CLI authenticated on this machine (`aws login` or an access key in `~\.aws`). Until then, use the local Alex and Blair sign-in.

### Google sign-in

Preferred path: a Cognito user pool in `ap-southeast-1` with Google as the identity provider, then set `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID`, `COGNITO_CLIENT_SECRET`, and `COGNITO_DOMAIN` in `workers/api/.env`. The callback is `http://localhost:5173/api/v1/auth/cognito/callback`. The hosted UI requests `openid email profile` and `identity_provider=Google`. It does not request Gmail.

Direct Google OIDC still works when Cognito is unset. Use redirect URI `http://localhost:5173/api/v1/auth/google/callback` and set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

The API deploys as a Lambda handler at `workers/api/src/lambda.ts`. Database host for that deploy is PostgreSQL, not the local Docker port.

## Checks

```powershell
pnpm typecheck
pnpm test
```

## Production notes

Production is `ENVIRONMENT=production` with dev sign-in off. The API entry for Lambda is `workers/api/src/lambda.ts`.

- Point `DATABASE_URL` at PostgreSQL and run `pnpm db:migrate` against that database.
- Set an `https` `PUBLIC_APP_URL` and a session secret of at least 32 characters. The local placeholder is refused.
- Put Cognito or Google credentials in the Lambda environment, not in the frontend.
- Serve the built web app on the same origin as the API so the session cookie stays first-party. Local development uses the Vite proxy instead.

See [docs/API.md](docs/API.md), [docs/DATABASE.md](docs/DATABASE.md), [docs/SECURITY.md](docs/SECURITY.md), and [docs/DECISIONS.md](docs/DECISIONS.md).
