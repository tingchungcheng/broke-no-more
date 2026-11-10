import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required.");

const sql = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), "../../../packages/database/migrations/0001_phase0.sql"),
  "utf8",
);

const client = new pg.Client({ connectionString });
await client.connect();
await client.query(sql);
await client.end();
console.log("Applied Phase 0 schema.");
