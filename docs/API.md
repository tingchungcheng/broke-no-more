# API

Base path: `/api/v1`. The session owns the user. A `userId` in the body or query is ignored as an authority and a body field named `userId` or `user_id` is rejected.

## Errors

```json
{ "error": { "code": "validation_error", "message": "Request is invalid.", "details": [] } }
```

## Auth

| Method | Path | Auth |
| --- | --- | --- |
| GET | `/auth/config` | Public. `{ googleAuthEnabled, devAuthEnabled }` |
| GET | `/auth/cognito` | Redirect to the Cognito hosted UI with Google. Identity scopes only |
| GET | `/auth/cognito/callback` | Sets `bnm_session` and redirects to `/dashboard` |
| GET | `/gmail/connect` | Signed-in user. Starts a separate `gmail.readonly` consent |
| GET | `/gmail/callback` | Seals the refresh token and returns to settings |
| POST | `/gmail/disconnect` | Revokes the token and deletes the sealed value |
| GET | `/auth/google` | Direct Google OIDC when Cognito is not configured |
| GET | `/auth/google/callback` | Sets `bnm_session` and redirects to `/dashboard` |
| POST | `/auth/dev-login` | Local only. Body `{ "persona": "alex" \| "blair" }` |
| GET | `/auth/me` | Session. Returns the profile, csrf token, and `gmailConnected` |
| POST | `/auth/logout` | Session plus csrf. Clears the cookie |

State-changing requests need header `X-Broke-No-More: 1`. Authenticated changes also need `X-CSRF-Token` from `/auth/me` or the login response.

Dev login returns 404 when `ENVIRONMENT` is anything other than `development` or `test`, even if the flag is true.

## Accounts

- `GET /accounts`
- `POST /accounts` with `{ type, displayName, institution?, currency, maskedIdentifier? }`
- `GET /accounts/:id`
- `DELETE /accounts/:id` also deletes that account's transactions

Currency is a 3-letter code. Masked identifiers are 4 digits or a mask like `****1234`.

## Transactions

- `GET /transactions?accountId=`
- `POST /transactions`
- `GET /transactions/:id`
- `DELETE /transactions/:id`

Create body:

```json
{
  "accountId": "uuid",
  "transactionDate": "2026-11-10",
  "description": "Coffee",
  "merchantName": "Corner stall",
  "amount": "8.50",
  "currency": "MYR",
  "direction": "OUT",
  "transactionType": "EXPENSE"
}
```

`amount` is a decimal string. The response uses `amountMinor`. Expenses must be `OUT`, income and refunds must be `IN`. The currency must match the account. The stored row uses `source: "MANUAL"` and `status: "CONFIRMED"`.

## Statements and sync jobs

`GET /statements`, `GET /statements/:id`, and `GET /sync-jobs` return only the caller's rows. Phase 0 has no upload or sync trigger.

## Health

`GET /health` runs `SELECT 1`.
