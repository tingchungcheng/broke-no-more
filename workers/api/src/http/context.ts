import type { Context } from "hono";
import { processEnv } from "../db";
import type { AppEnv, Env } from "../env";

export function getEnv(c: Context<AppEnv>): Env {
  if (c.env?.db) return c.env;
  return processEnv();
}
