import { Hono } from "hono";
import { STATEMENT_SOURCES, STATEMENT_STATUSES } from "@broke-no-more/shared";
import { z } from "zod";
import type { AppEnv } from "../env";
import { getEnv } from "../http/context";
import { ApiError } from "../http/errors";
import { requireMutationCsrf, requireUser } from "../middleware/guards";
import {
  findStatement,
  listStatementsPage,
  listSyncJobs,
  STATEMENT_LIST_SORT_FIELDS,
  STATEMENTS_PAGE_SIZE,
} from "../repositories/records";
import { requireUuid } from "./ids";

const statementSchema = z.object({
  id: z.string().uuid(),
  accountId: z.string().uuid().nullable(),
  source: z.enum(STATEMENT_SOURCES),
  status: z.enum(STATEMENT_STATUSES),
  originalFilename: z.string().nullable(),
  periodStart: z.string().nullable(),
  periodEnd: z.string().nullable(),
  errorCode: z.string().nullable(),
  subject: z.string().nullable(),
  sender: z.string().nullable(),
  receivedOn: z.string().nullable(),
  matchedKeywords: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
});

function presentStatement(row: {
  id: string;
  accountId: string | null;
  source: string;
  status: string;
  originalFilename: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  errorCode: string | null;
  subject: string | null;
  sender: string | null;
  receivedOn: string | null;
  matchedKeywords: string | null;
  createdAt: string;
  updatedAt: string;
}) {
  return statementSchema.parse({
    ...row,
    matchedKeywords: (row.matchedKeywords ?? "")
      .split(",")
      .map((keyword) => keyword.trim())
      .filter(Boolean),
  });
}

const syncJobSchema = z.object({
  id: z.string().uuid(),
  kind: z.string(),
  status: z.enum(["pending", "running", "succeeded", "failed"]),
  retryCount: z.number().int(),
  errorCode: z.string().nullable(),
  startedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
  createdAt: z.string(),
});

export const statementRoutes = new Hono<AppEnv>();
statementRoutes.use("*", requireUser, requireMutationCsrf);

const statementListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    sort: z.enum(STATEMENT_LIST_SORT_FIELDS).default("receivedOn"),
    order: z.enum(["asc", "desc"]).default("desc"),
  })
  .strict();

statementRoutes.get("/", async (c) => {
  const parsed = statementListQuerySchema.safeParse({
    page: c.req.query("page") ?? 1,
    sort: c.req.query("sort"),
    order: c.req.query("order"),
  });
  if (!parsed.success) throw new ApiError(400, "validation_error", "Request is invalid.");
  const listed = await listStatementsPage(getEnv(c).db, c.get("userId"), parsed.data.page, STATEMENTS_PAGE_SIZE, {
    sort: parsed.data.sort,
    order: parsed.data.order,
  });
  return c.json({
    statements: listed.rows.map((row) => presentStatement(row)),
    page: listed.page,
    pageSize: listed.pageSize,
    total: listed.total,
    pageCount: listed.pageCount,
    hasMore: listed.hasMore,
    sort: parsed.data.sort,
    order: parsed.data.order,
  });
});

statementRoutes.get("/:id", async (c) => {
  const row = await findStatement(getEnv(c).db, c.get("userId"), requireUuid(c.req.param("id")));
  if (!row) throw new ApiError(404, "statement_not_found", "Statement not found.");
  return c.json({ statement: presentStatement(row) });
});

export const syncJobRoutes = new Hono<AppEnv>();
syncJobRoutes.use("*", requireUser, requireMutationCsrf);

syncJobRoutes.get("/", async (c) => {
  const rows = await listSyncJobs(getEnv(c).db, c.get("userId"));
  return c.json({
    syncJobs: rows.slice(0, 100).map((row) => syncJobSchema.parse(row)),
    truncated: rows.length > 100,
  });
});
