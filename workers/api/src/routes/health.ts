import { sql } from "drizzle-orm";
import { Hono } from "hono";
import type { AppEnv } from "../env";
import { getEnv } from "../http/context";

export const healthRoutes = new Hono<AppEnv>();

healthRoutes.get("/", async (c) => {
  try {
    await getEnv(c).db.execute(sql`select 1`);
  } catch {
    return c.json({ error: { code: "unavailable", message: "Database is unavailable." } }, 503);
  }
  return c.json({ ok: true });
});
