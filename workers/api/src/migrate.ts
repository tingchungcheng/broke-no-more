import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required.");

const directory = resolve(dirname(fileURLToPath(import.meta.url)), "../../../packages/database/migrations");
const files = readdirSync(directory)
  .filter((file) => file.endsWith(".sql"))
  .sort();

const client = new pg.Client({ connectionString });
await client.connect();
await client.query(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    id TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL
  )
`);

const users = await client.query<{ name: string | null }>("SELECT to_regclass('public.users') AS name");
const recorded = await client.query<{ id: string }>("SELECT id FROM schema_migrations");
const applied = new Set(recorded.rows.map((row) => row.id));
if (users.rows[0]?.name && !applied.has("0001_phase0.sql")) {
  await client.query("INSERT INTO schema_migrations (id, applied_at) VALUES ($1, $2)", [
    "0001_phase0.sql",
    new Date().toISOString(),
  ]);
  applied.add("0001_phase0.sql");
}

for (const file of files) {
  if (applied.has(file)) continue;
  await client.query(readFileSync(resolve(directory, file), "utf8"));
  await client.query("INSERT INTO schema_migrations (id, applied_at) VALUES ($1, $2)", [file, new Date().toISOString()]);
  console.log(`Applied ${file}`);
}

await client.end();
console.log("Migrations are current.");
