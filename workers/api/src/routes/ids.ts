import { z } from "zod";
import { ApiError } from "../http/errors";

export function requireUuid(value: string | undefined): string {
  const parsed = z.string().uuid().safeParse(value);
  if (!parsed.success) throw new ApiError(400, "validation_error", "The id must be a uuid.");
  return parsed.data;
}
