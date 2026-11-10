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

export function appPath(env: Env, path: string): string {
  if (!path.startsWith("/") || path.startsWith("//")) {
    throw new ApiError(500, "misconfigured", "Redirect path is invalid.");
  }
  return `${publicOrigin(env)}${path}`;
}
