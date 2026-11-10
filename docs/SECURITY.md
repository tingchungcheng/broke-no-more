# Security

Phase 0 controls:

- Google sign-in uses `openid email profile`. Direct Google also sets `include_granted_scopes=false`. Cognito's hosted UI adds `identity_provider=Google` and does not request Gmail.
- The identity key is the provider subject, not email. A Cognito subject is stored as `cognito:<sub>`.
- The session id in `bnm_session` is random. The database stores its SHA-256 hash. The cookie is HttpOnly, `SameSite=Lax`, and `Secure` outside development and test.
- OAuth `state`, PKCE, and `nonce` live in a short-lived signed HttpOnly cookie. A callback with a bad or missing state does not call Google.
- Changes require `X-Broke-No-More: 1`. Authenticated changes also require the csrf token stored on the session.
- If an `Origin` header is present, it must match `PUBLIC_APP_URL`. Development and test also accept the localhost / 127.0.0.1 pair for that URL.
- Queries use the session user id. A body `userId` is rejected. Another user's account, transaction, statement, or sync job returns 404.
- Full card numbers are rejected. Pictures are kept only when they are `https`.
- Dev personas (`dev:alex`, `dev:blair`) exist only when `ENVIRONMENT` is `development` or `test` and `DEV_AUTH_ENABLED=true`. Any other environment is treated as production and returns 404 for dev sign-in even if the flag is true. The local session secret is refused in production.
- Logs avoid OAuth codes, tokens, and request bodies. Validation errors return field messages without echoing the submitted value.

Known gaps, left for later phases:

- No rate limits yet.
- A Gmail refresh token is sealed with AES-GCM before it is stored. The browser never receives it. A statement scan refreshes an access token on the server. Reading a saved statement downloads the PDF or CSV on the server, seals the file, and stores a statement password only after sealing it. The password tried is the one whose saved phrase appears in the email subject. The browser never receives the password, the file, or the token. If the opened text is not a known table and an OpenAI key is set, that text is sent to OpenAI. The password and the Gmail token are not. Disconnect revokes the token and deletes the sealed token.
- No full-workspace export or deletion yet. Account delete removes that account and its transactions.
- Production should terminate TLS on the same origin as the API. The local app relies on the Vite proxy for that.
