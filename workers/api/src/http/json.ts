import type { Context } from "hono";
import type { ZodType } from "zod";
import { ApiError } from "./errors";

export async function readJson<T>(c: Context, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new ApiError(400, "invalid_json", "Request body must be JSON.");
  }

  if (body && typeof body === "object" && ("userId" in body || "user_id" in body)) {
    throw new ApiError(400, "validation_error", "Do not send a user id. The session decides who you are.");
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError(
      400,
      "validation_error",
      "Request is invalid.",
      parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    );
  }
  return parsed.data;
}
