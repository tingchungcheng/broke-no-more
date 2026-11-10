import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { AppEnv } from "../env";
import { isProduction } from "../env";
import { getEnv } from "./context";

export const SESSION_COOKIE = "bnm_session";
export const OAUTH_COOKIE = "bnm_oauth";
export const GMAIL_COOKIE = "bnm_gmail";

function cookieBase(c: Context<AppEnv>) {
  return {
    httpOnly: true,
    secure: isProduction(getEnv(c)),
    sameSite: "Lax" as const,
    path: "/",
  };
}

export function readCookie(c: Context<AppEnv>, name: string): string | undefined {
  return getCookie(c, name);
}

export function writeSessionCookie(c: Context<AppEnv>, token: string): void {
  setCookie(c, SESSION_COOKIE, token, { ...cookieBase(c), maxAge: 60 * 60 * 24 * 7 });
}

export function writeOauthCookie(c: Context<AppEnv>, value: string): void {
  setCookie(c, OAUTH_COOKIE, value, { ...cookieBase(c), maxAge: 60 * 10 });
}

export function writeGmailCookie(c: Context<AppEnv>, value: string): void {
  setCookie(c, GMAIL_COOKIE, value, { ...cookieBase(c), maxAge: 60 * 10 });
}

export function clearCookie(c: Context<AppEnv>, name: string): void {
  deleteCookie(c, name, { path: "/", secure: isProduction(getEnv(c)), sameSite: "Lax" });
}
