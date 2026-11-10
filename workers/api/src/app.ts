import { Hono } from "hono";
import type { AppEnv } from "./env";
import { errorHandler } from "./http/errors";
import { requireAllowedOrigin, requireAppHeader } from "./middleware/guards";
import { accountRoutes } from "./routes/accounts";
import { authRoutes } from "./routes/auth";
import { healthRoutes } from "./routes/health";
import { statementRoutes, syncJobRoutes } from "./routes/records";
import { transactionRoutes } from "./routes/transactions";

export const app = new Hono<AppEnv>();

app.onError(errorHandler);
app.use("/api/*", requireAllowedOrigin);
app.use("/api/*", requireAppHeader);

const v1 = new Hono<AppEnv>();
v1.route("/health", healthRoutes);
v1.route("/auth", authRoutes);
v1.route("/accounts", accountRoutes);
v1.route("/transactions", transactionRoutes);
v1.route("/statements", statementRoutes);
v1.route("/sync-jobs", syncJobRoutes);
app.route("/api/v1", v1);

app.notFound((c) => {
  if (c.req.path.startsWith("/api/")) {
    return c.json({ error: { code: "not_found", message: "Not found." } }, 404);
  }
  return c.text("Not found", 404);
});
