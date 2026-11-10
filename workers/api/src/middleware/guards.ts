import type { MiddlewareHandler } from "hono";
import { safeEqual } from "../auth/crypto";
import { findActiveSession } from "../auth/session";
import type { AppEnv } from "../env";
import { getEnv } from "../http/context";
import { ApiError } from "../http/errors";
import { readCookie, SESSION_COOKIE } from "../http/cookies";
import { isAllowedBrowserOrigin } from "../http/origin";

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export const requireAppHeader: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (MUTATING.has(c.req.method) && c.req.header("x-broke-no-more") !== "1") {
    throw new ApiError(403, "missing_client_header", "This action must be sent from the Broke No More app.");
  }
  await next();
};

export const requireAllowedOrigin: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!isAllowedBrowserOrigin(getEnv(c), c.req.header("origin"))) {
    throw new ApiError(403, "forbidden_origin", "Origin is not allowed.");
  }
  await next();
};

export const requireUser: MiddlewareHandler<AppEnv> = async (c, next) => {
  const token = readCookie(c, SESSION_COOKIE);
  if (!token) throw new ApiError(401, "unauthenticated", "Sign in required.");
  const session = await findActiveSession(getEnv(c).db, token);
  if (!session) throw new ApiError(401, "unauthenticated", "Sign in required.");
  c.set("userId", session.userId);
  c.set("sessionId", session.id);
  c.set("csrfToken", session.csrfToken);
  await next();
};

export const requireMutationCsrf: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!MUTATING.has(c.req.method)) {
    await next();
    return;
  }
  const sent = c.req.header("x-csrf-token") ?? "";
  if (!safeEqual(sent, c.get("csrfToken"))) {
    throw new ApiError(403, "invalid_csrf", "The security token did not match. Refresh the page and try again.");
  }
  await next();
};
