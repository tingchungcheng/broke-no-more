import * as schema from "@broke-no-more/database";
import { ACCOUNT_TYPES } from "@broke-no-more/shared";
import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readSignedValue } from "../src/auth/crypto";
import type { OauthState } from "../src/auth/google";
import { app } from "../src/app";
import type { Database } from "../src/db";
import type { Env } from "../src/env";

const migration = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), "../../../packages/database/migrations/0001_phase0.sql"),
  "utf8",
);

async function testEnv(overrides: Partial<Env> = {}): Promise<Env> {
  const client = new PGlite();
  await client.exec(migration);
  const db = drizzle(client, { schema }) as unknown as Database;
  return {
    db,
    ENVIRONMENT: "test",
    PUBLIC_APP_URL: "http://localhost:5173",
    SESSION_SECRET: "test-session-secret-must-be-32chars-min",
    DEV_AUTH_ENABLED: "true",
    GOOGLE_CLIENT_ID: "",
    GOOGLE_CLIENT_SECRET: "",
    ...overrides,
  };
}

function cookiePair(response: Response, name: string): string {
  const cookies = response.headers.getSetCookie();
  const match = cookies.find((cookie) => cookie.startsWith(`${name}=`));
  if (!match) throw new Error(`Missing ${name} cookie. Saw: ${cookies.join(" | ")}`);
  return match.split(";")[0] ?? match;
}

async function devLogin(env: Env, persona: "alex" | "blair") {
  const response = await app.request(
    "/api/v1/auth/dev-login",
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-broke-no-more": "1" },
      body: JSON.stringify({ persona }),
    },
    env,
  );
  expect(response.status).toBe(200);
  const body = (await response.json()) as { csrfToken: string; user: { id: string; email: string } };
  return { cookie: cookiePair(response, "bnm_session"), csrfToken: body.csrfToken, user: body.user };
}

function authed(cookie: string, csrfToken?: string, extra?: ConstructorParameters<typeof Headers>[0]): Headers {
  const headers = new Headers(extra);
  headers.set("cookie", cookie);
  headers.set("x-broke-no-more", "1");
  if (csrfToken) headers.set("x-csrf-token", csrfToken);
  return headers;
}

async function createAccount(env: Env, session: Awaited<ReturnType<typeof devLogin>>, displayName: string) {
  const response = await app.request(
    "/api/v1/accounts",
    {
      method: "POST",
      headers: authed(session.cookie, session.csrfToken, { "content-type": "application/json" }),
      body: JSON.stringify({ type: "CASH", displayName, currency: "MYR" }),
    },
    env,
  );
  expect(response.status).toBe(201);
  const body = (await response.json()) as { account: { id: string } };
  return body.account;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("phase 0 API", () => {
  it("keeps the migration aligned with the account types", () => {
    for (const type of ACCOUNT_TYPES) expect(migration).toContain(`'${type}'`);
  });

  it("answers health checks from the database", async () => {
    const response = await app.request("/api/v1/health", {}, await testEnv());
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("requires a session and a matching csrf token", async () => {
    const env = await testEnv();
    const anonymous = await app.request("/api/v1/accounts", {}, env);
    expect(anonymous.status).toBe(401);

    const session = await devLogin(env, "alex");
    const missing = await app.request(
      "/api/v1/accounts",
      {
        method: "POST",
        headers: authed(session.cookie, undefined, { "content-type": "application/json" }),
        body: JSON.stringify({ type: "CASH", displayName: "Wallet", currency: "MYR" }),
      },
      env,
    );
    expect(missing.status).toBe(403);

    const headerless = await app.request(
      "/api/v1/auth/dev-login",
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ persona: "alex" }) },
      env,
    );
    expect(headerless.status).toBe(403);
  });

  it("accepts localhost and 127.0.0.1 as the same dev origin", async () => {
    const env = await testEnv();
    const response = await app.request(
      "/api/v1/auth/dev-login",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-broke-no-more": "1",
          origin: "http://127.0.0.1:5173",
        },
        body: JSON.stringify({ persona: "alex" }),
      },
      env,
    );
    expect(response.status).toBe(200);

    const production = await testEnv({
      ENVIRONMENT: "production",
      PUBLIC_APP_URL: "https://ledger.example.com",
      SESSION_SECRET: "production-session-secret-must-be-32chars",
      DEV_AUTH_ENABLED: "false",
    });
    const rejected = await app.request(
      "/api/v1/auth/config",
      { headers: { origin: "https://127.0.0.1" } },
      production,
    );
    expect(rejected.status).toBe(403);
  });

  it("hides dev sign-in outside development and test", async () => {
    const env = await testEnv({ ENVIRONMENT: "production", PUBLIC_APP_URL: "https://ledger.example.com", DEV_AUTH_ENABLED: "true" });
    const response = await app.request(
      "/api/v1/auth/dev-login",
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-broke-no-more": "1" },
        body: JSON.stringify({ persona: "alex" }),
      },
      env,
    );
    expect(response.status).toBe(404);
    const config = await app.request("/api/v1/auth/config", {}, env);
    await expect(config.json()).resolves.toMatchObject({ devAuthEnabled: false });
  });

  it("rejects a client-supplied user id, a full card number, and a mismatched direction", async () => {
    const env = await testEnv();
    const session = await devLogin(env, "alex");
    const spoofed = await app.request(
      "/api/v1/accounts",
      {
        method: "POST",
        headers: authed(session.cookie, session.csrfToken, { "content-type": "application/json" }),
        body: JSON.stringify({ type: "CASH", displayName: "Wallet", currency: "MYR", userId: session.user.id }),
      },
      env,
    );
    expect(spoofed.status).toBe(400);

    const card = await app.request(
      "/api/v1/accounts",
      {
        method: "POST",
        headers: authed(session.cookie, session.csrfToken, { "content-type": "application/json" }),
        body: JSON.stringify({
          type: "CREDIT_CARD",
          displayName: "Card",
          currency: "MYR",
          maskedIdentifier: "4111111111111111",
        }),
      },
      env,
    );
    expect(card.status).toBe(400);

    const account = await createAccount(env, session, "Cash");
    const incomeOut = await app.request(
      "/api/v1/transactions",
      {
        method: "POST",
        headers: authed(session.cookie, session.csrfToken, { "content-type": "application/json" }),
        body: JSON.stringify({
          accountId: account.id,
          transactionDate: "2026-11-10",
          description: "Salary",
          amount: "10.00",
          currency: "MYR",
          direction: "OUT",
          transactionType: "INCOME",
        }),
      },
      env,
    );
    expect(incomeOut.status).toBe(400);
  });

  it("isolates accounts, transactions, statements, and sync jobs by user", async () => {
    const env = await testEnv();
    const alex = await devLogin(env, "alex");
    const blair = await devLogin(env, "blair");
    const account = await createAccount(env, alex, "Alex cash");
    const created = await app.request(
      "/api/v1/transactions",
      {
        method: "POST",
        headers: authed(alex.cookie, alex.csrfToken, { "content-type": "application/json" }),
        body: JSON.stringify({
          accountId: account.id,
          transactionDate: "2026-11-10",
          description: "Coffee",
          merchantName: "Corner stall",
          amount: "8.50",
          currency: "MYR",
          direction: "OUT",
          transactionType: "EXPENSE",
        }),
      },
      env,
    );
    expect(created.status).toBe(201);
    const transaction = ((await created.json()) as { transaction: { id: string; amountMinor: number; description: string } }).transaction;
    expect(transaction.amountMinor).toBe(850);
    expect(transaction.description).toBe("Coffee");

    const blairAccounts = await app.request("/api/v1/accounts", { headers: authed(blair.cookie) }, env);
    await expect(blairAccounts.json()).resolves.toEqual({ accounts: [], truncated: false });
    const hiddenAccount = await app.request(`/api/v1/accounts/${account.id}`, { headers: authed(blair.cookie) }, env);
    expect(hiddenAccount.status).toBe(404);
    const hiddenTransaction = await app.request(`/api/v1/transactions/${transaction.id}`, { headers: authed(blair.cookie) }, env);
    expect(hiddenTransaction.status).toBe(404);

    const probed = await app.request(`/api/v1/accounts?userId=${alex.user.id}`, { headers: authed(blair.cookie) }, env);
    await expect(probed.json()).resolves.toEqual({ accounts: [], truncated: false });

    const stolen = await app.request(
      "/api/v1/transactions",
      {
        method: "POST",
        headers: authed(blair.cookie, blair.csrfToken, { "content-type": "application/json" }),
        body: JSON.stringify({
          accountId: account.id,
          transactionDate: "2026-11-10",
          description: "Not Blair's",
          amount: "1.00",
          currency: "MYR",
          direction: "OUT",
          transactionType: "EXPENSE",
        }),
      },
      env,
    );
    expect(stolen.status).toBe(404);

    const removed = await app.request(`/api/v1/accounts/${account.id}`, { method: "DELETE", headers: authed(blair.cookie, blair.csrfToken) }, env);
    expect(removed.status).toBe(404);
    const stillThere = await app.request(`/api/v1/accounts/${account.id}`, { headers: authed(alex.cookie) }, env);
    expect(stillThere.status).toBe(200);

    const now = new Date().toISOString();
    const statementId = crypto.randomUUID();
    await env.db.execute(sql`
      insert into statements (id, user_id, source, status, created_at, updated_at)
      values (${statementId}, ${alex.user.id}, 'UPLOAD', 'STORED', ${now}, ${now})
    `);
    const syncId = crypto.randomUUID();
    await env.db.execute(sql`
      insert into sync_jobs (id, user_id, kind, status, retry_count, created_at, updated_at)
      values (${syncId}, ${alex.user.id}, 'gmail_sync', 'pending', 0, ${now}, ${now})
    `);

    const blairStatements = await app.request("/api/v1/statements", { headers: authed(blair.cookie) }, env);
    await expect(blairStatements.json()).resolves.toEqual({ statements: [], truncated: false });
    expect((await app.request(`/api/v1/statements/${statementId}`, { headers: authed(blair.cookie) }, env)).status).toBe(404);
    const alexStatements = await app.request("/api/v1/statements", { headers: authed(alex.cookie) }, env);
    const alexBody = (await alexStatements.json()) as { statements: { id: string }[] };
    expect(alexBody.statements.map((statement) => statement.id)).toEqual([statementId]);
    const blairJobs = await app.request("/api/v1/sync-jobs", { headers: authed(blair.cookie) }, env);
    await expect(blairJobs.json()).resolves.toEqual({ syncJobs: [], truncated: false });

    await expect(
      env.db.execute(sql`
        insert into transactions (
          id, user_id, account_id, transaction_date, description_raw, description_normalized,
          amount_minor, currency, direction, transaction_type, status, source, created_at, updated_at
        ) values (
          ${crypto.randomUUID()}, ${alex.user.id}, ${crypto.randomUUID()}, '2026-11-10', 'Nope', 'nope',
          100, 'MYR', 'OUT', 'EXPENSE', 'CONFIRMED', 'MANUAL', ${now}, ${now}
        )
      `),
    ).rejects.toThrow();
  });

  it("rejects a foreign origin and ends a session on logout", async () => {
    const env = await testEnv();
    const origin = await app.request("/api/v1/health", { headers: { origin: "https://evil.example" } }, env);
    expect(origin.status).toBe(403);

    const session = await devLogin(env, "alex");
    const loggedOut = await app.request("/api/v1/auth/logout", { method: "POST", headers: authed(session.cookie, session.csrfToken) }, env);
    expect(loggedOut.status).toBe(204);
    const me = await app.request("/api/v1/auth/me", { headers: authed(session.cookie) }, env);
    expect(me.status).toBe(401);
  });

  it("starts Google sign-in with identity scopes only", async () => {
    const env = await testEnv({ GOOGLE_CLIENT_ID: "test-client-id", GOOGLE_CLIENT_SECRET: "test-client-secret" });
    const response = await app.request("/api/v1/auth/google", {}, env);
    expect(response.status).toBe(302);
    const location = new URL(response.headers.get("location") ?? "");
    expect(`${location.origin}${location.pathname}`).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(location.searchParams.get("scope")).toBe("openid email profile");
    expect(location.searchParams.get("include_granted_scopes")).toBe("false");
    expect(location.searchParams.has("access_type")).toBe(false);
    expect(location.toString().toLowerCase()).not.toContain("gmail");
    expect(location.searchParams.get("redirect_uri")).toBe("http://localhost:5173/api/v1/auth/google/callback");
  });

  it("sends the Cognito hosted UI to Google with identity scopes only", async () => {
    const env = await testEnv({
      COGNITO_USER_POOL_ID: "ap-southeast-1_example",
      COGNITO_CLIENT_ID: "cognito-client",
      COGNITO_DOMAIN: "broke-no-more.auth.ap-southeast-1.amazoncognito.com",
    });
    const response = await app.request("/api/v1/auth/cognito", {}, env);
    expect(response.status).toBe(302);
    const location = new URL(response.headers.get("location") ?? "");
    expect(`${location.origin}${location.pathname}`).toBe(
      "https://broke-no-more.auth.ap-southeast-1.amazoncognito.com/oauth2/authorize",
    );
    expect(location.searchParams.get("scope")).toBe("openid email profile");
    expect(location.searchParams.get("identity_provider")).toBe("Google");
    expect(location.searchParams.get("redirect_uri")).toBe("http://localhost:5173/api/v1/auth/cognito/callback");
    expect(location.searchParams.has("access_type")).toBe(false);
    expect(location.toString().toLowerCase()).not.toContain("gmail");
  });

  it("rejects a Google callback whose state cookie is missing without calling Google", async () => {
    const env = await testEnv({ GOOGLE_CLIENT_ID: "test-client-id", GOOGLE_CLIENT_SECRET: "test-client-secret" });
    const fetchMock = vi.fn(() => {
      throw new Error("Google should not be called");
    });
    vi.stubGlobal("fetch", fetchMock);
    const response = await app.request("/api/v1/auth/google/callback?code=abc&state=nope", {}, env);
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("http://localhost:5173/login?error=google_auth_failed");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("signs a user in from a verified Google id token", async () => {
    const env = await testEnv({ GOOGLE_CLIENT_ID: "test-client-id", GOOGLE_CLIENT_SECRET: "test-client-secret" });
    const start = await app.request("/api/v1/auth/google", {}, env);
    const location = new URL(start.headers.get("location") ?? "");
    const oauth = await readSignedValue<OauthState>(
      decodeURIComponent(cookiePair(start, "bnm_oauth").slice("bnm_oauth=".length)),
      env.SESSION_SECRET ?? "",
    );
    expect(oauth.state).toBe(location.searchParams.get("state"));

    const { privateKey, publicKey } = await generateKeyPair("RS256", { extractable: true });
    const jwk = await exportJWK(publicKey);
    jwk.kid = "test-key";
    jwk.alg = "RS256";
    jwk.use = "sig";
    const idToken = await new SignJWT({
      email: "casey@example.com",
      email_verified: true,
      name: "Casey Rahman",
      nonce: oauth.nonce,
      picture: "http://example.com/not-secure.png",
    })
      .setProtectedHeader({ alg: "RS256", kid: "test-key" })
      .setIssuer("https://accounts.google.com")
      .setAudience("test-client-id")
      .setSubject("google-sub-casey")
      .setIssuedAt()
      .setExpirationTime("2h")
      .sign(privateKey);

    vi.stubGlobal("fetch", async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
      const url = String(input);
      if (url.startsWith("https://oauth2.googleapis.com/token")) {
        expect(String(init?.body)).toContain(oauth.verifier);
        return Response.json({ id_token: idToken });
      }
      if (url.startsWith("https://www.googleapis.com/oauth2/v3/certs")) {
        return Response.json({ keys: [jwk] });
      }
      throw new Error(`Unexpected fetch ${url}`);
    });

    const callback = await app.request(
      `/api/v1/auth/google/callback?code=test-code&state=${encodeURIComponent(oauth.state)}`,
      { headers: { cookie: cookiePair(start, "bnm_oauth") } },
      env,
    );
    expect(callback.status).toBe(302);
    expect(callback.headers.get("location")).toBe("http://localhost:5173/dashboard");

    const me = await app.request("/api/v1/auth/me", { headers: { cookie: cookiePair(callback, "bnm_session") } }, env);
    expect(me.status).toBe(200);
    const body = (await me.json()) as { user: { email: string; name: string; pictureUrl: string | null }; gmailConnected: boolean };
    expect(body.user).toMatchObject({ email: "casey@example.com", name: "Casey Rahman", pictureUrl: null });
    expect(body.gmailConnected).toBe(false);
  });
});
