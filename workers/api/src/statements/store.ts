import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import type { Env } from "../env";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function statementStorageRoot(env: Env): string {
  if (env.STATEMENT_STORAGE_DIR) return resolve(env.STATEMENT_STORAGE_DIR);
  return resolve(process.cwd(), "data", "statements");
}

export async function storeSealedStatement(root: string, userId: string, statementId: string, sealed: string): Promise<string> {
  if (!UUID.test(userId) || !UUID.test(statementId)) throw new Error("Statement storage id is invalid.");
  const relative = `${userId}/${statementId}.seal`;
  const full = join(root, relative);
  await mkdir(dirname(full), { recursive: true });
  await writeFile(full, sealed, { encoding: "utf8", flag: "w" });
  return relative;
}
