import { Hono } from "hono";
import { accounts } from "@broke-no-more/database";
import { accountSchema, createAccountSchema } from "@broke-no-more/shared";
import type { AppEnv } from "../env";
import { getEnv } from "../http/context";
import { ApiError } from "../http/errors";
import { readJson } from "../http/json";
import { requireMutationCsrf, requireUser } from "../middleware/guards";
import { deleteAccount, findAccount, listAccounts } from "../repositories/accounts";
import { requireUuid } from "./ids";

export const accountRoutes = new Hono<AppEnv>();
accountRoutes.use("*", requireUser, requireMutationCsrf);

accountRoutes.get("/", async (c) => {
  const rows = await listAccounts(getEnv(c).db, c.get("userId"));
  return c.json({
    accounts: rows.slice(0, 100).map((row) => accountSchema.parse(row)),
    truncated: rows.length > 100,
  });
});

accountRoutes.post("/", async (c) => {
  const input = await readJson(c, createAccountSchema);
  const now = new Date().toISOString();
  const row = {
    id: crypto.randomUUID(),
    userId: c.get("userId"),
    type: input.type,
    institution: input.institution ?? null,
    displayName: input.displayName,
    currency: input.currency,
    maskedIdentifier: input.maskedIdentifier ? input.maskedIdentifier : null,
    createdAt: now,
    updatedAt: now,
  };
  await getEnv(c).db.insert(accounts).values(row);
  return c.json({ account: accountSchema.parse(row) }, 201);
});

accountRoutes.get("/:id", async (c) => {
  const id = requireUuid(c.req.param("id"));
  const row = await findAccount(getEnv(c).db, c.get("userId"), id);
  if (!row) throw new ApiError(404, "account_not_found", "Account not found.");
  return c.json({ account: accountSchema.parse(row) });
});

accountRoutes.delete("/:id", async (c) => {
  const id = requireUuid(c.req.param("id"));
  const db = getEnv(c).db;
  const row = await findAccount(db, c.get("userId"), id);
  if (!row) throw new ApiError(404, "account_not_found", "Account not found.");
  await deleteAccount(db, c.get("userId"), id);
  return c.body(null, 204);
});
