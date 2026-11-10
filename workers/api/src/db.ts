import * as schema from "@broke-no-more/database";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { type Env, readConfig } from "./env";

export type Database = NodePgDatabase<typeof schema>;

let cached: Env | null = null;

export function databaseFromPool(pool: Pool): Database {
  return drizzle(pool, { schema });
}

export function processEnv(): Env {
  if (cached) return cached;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required.");
  cached = {
    db: databaseFromPool(new Pool({ connectionString })),
    ...readConfig(process.env),
  };
  return cached;
}
