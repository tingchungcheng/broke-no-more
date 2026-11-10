import type { Database } from "./db";

export type EnvConfig = {
  ENVIRONMENT?: string;
  PUBLIC_APP_URL?: string;
  SESSION_SECRET?: string;
  DEV_AUTH_ENABLED?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  COGNITO_REGION?: string;
  COGNITO_USER_POOL_ID?: string;
  COGNITO_CLIENT_ID?: string;
  COGNITO_CLIENT_SECRET?: string;
  COGNITO_DOMAIN?: string;
};

export type Env = EnvConfig & {
  db: Database;
};

export type AppVariables = {
  userId: string;
  sessionId: string;
  csrfToken: string;
};

export type AppEnv = {
  Bindings: Env;
  Variables: AppVariables;
};

export function readConfig(source: NodeJS.ProcessEnv | EnvConfig): EnvConfig {
  return {
    ENVIRONMENT: source.ENVIRONMENT,
    PUBLIC_APP_URL: source.PUBLIC_APP_URL,
    SESSION_SECRET: source.SESSION_SECRET,
    DEV_AUTH_ENABLED: source.DEV_AUTH_ENABLED,
    GOOGLE_CLIENT_ID: source.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: source.GOOGLE_CLIENT_SECRET,
    COGNITO_REGION: source.COGNITO_REGION,
    COGNITO_USER_POOL_ID: source.COGNITO_USER_POOL_ID,
    COGNITO_CLIENT_ID: source.COGNITO_CLIENT_ID,
    COGNITO_CLIENT_SECRET: source.COGNITO_CLIENT_SECRET,
    COGNITO_DOMAIN: source.COGNITO_DOMAIN,
  };
}

export function isProduction(env: EnvConfig): boolean {
  return env.ENVIRONMENT !== "development" && env.ENVIRONMENT !== "test";
}

export function isDevAuthAllowed(env: EnvConfig): boolean {
  return !isProduction(env) && env.DEV_AUTH_ENABLED === "true";
}

export function googleAuthConfigured(env: EnvConfig): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

export function cognitoAuthConfigured(env: EnvConfig): boolean {
  return Boolean(env.COGNITO_USER_POOL_ID && env.COGNITO_CLIENT_ID && env.COGNITO_DOMAIN);
}

const LOCAL_SESSION_SECRET = "local-dev-only-session-secret-not-for-production";

export function sessionSecret(env: EnvConfig): string {
  const secret = env.SESSION_SECRET ?? "";
  if (secret.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters.");
  }
  if (isProduction(env) && secret === LOCAL_SESSION_SECRET) {
    throw new Error("Refusing the local development session secret in production.");
  }
  return secret;
}
