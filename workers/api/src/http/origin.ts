import { ApiError } from "../http/errors";
import type { Env } from "../env";
import { isProduction } from "../env";

export function publicOrigin(env: Env): string {
  let url: URL;
  try {
    url = new URL(env.PUBLIC_APP_URL ?? "");
  } catch {
    throw new ApiError(500, "misconfigured", "PUBLIC_APP_URL is invalid.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new ApiError(500, "misconfigured", "PUBLIC_APP_URL must use http or https.");
  }
  if (isProduction(env) && url.protocol !== "https:") {
    throw new ApiError(500, "misconfigured", "Production requires an https PUBLIC_APP_URL.");
  }
  return url.origin;
}

export function isAllowedBrowserOrigin(env: Env, origin: string | undefined): boolean {
  if (!origin) return true;
  const allowed = publicOrigin(env);
  if (origin === allowed) return true;
  if (isProduction(env)) return false;
  return loopbackTwin(allowed) === origin;
}

function loopbackTwin(origin: string): string | null {
  const url = new URL(origin);
  if (url.hostname === "localhost") url.hostname = "127.0.0.1";
  else if (url.hostname === "127.0.0.1") url.hostname = "localhost";
  else return null;
  return url.origin;
}

export function appPath(env: Env, path: string): string {
  if (!path.startsWith("/") || path.startsWith("//")) {
    throw new ApiError(500, "misconfigured", "Redirect path is invalid.");
  }
  return `${publicOrigin(env)}${path}`;
}
