import type { Context } from "hono";
import { ZodError } from "zod";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function errorBody(error: unknown, environment: string | undefined) {
  if (error instanceof ApiError) {
    return {
      status: error.status,
      body: {
        error: {
          code: error.code,
          message: error.message,
          ...(error.details === undefined ? {} : { details: error.details }),
        },
      },
    };
  }

  if (error instanceof ZodError) {
    return {
      status: 400,
      body: {
        error: {
          code: "validation_error",
          message: "Request is invalid.",
          details: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
      },
    };
  }

  if (environment === "development" || environment === "test") {
    console.error(error instanceof Error ? `${error.name}: ${error.message}` : "Unknown error");
  } else {
    console.error(error instanceof Error ? error.name : "Unknown error");
  }

  return {
    status: 500,
    body: { error: { code: "internal_error", message: "Something went wrong." } },
  };
}

export function errorHandler(error: Error, c: Context) {
  const rendered = errorBody(error, c.env?.ENVIRONMENT);
  return c.json(rendered.body, rendered.status as 400);
}
