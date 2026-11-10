import { z } from "zod";
import {
  ACCOUNT_TYPES,
  DIRECTIONS,
  TRANSACTION_SOURCES,
  TRANSACTION_STATUSES,
  TRANSACTION_TYPES,
} from "./constants";

export const currencySchema = z
  .string()
  .trim()
  .transform((value) => value.toUpperCase())
  .pipe(z.string().regex(/^[A-Z]{3}$/, "Use a 3-letter currency code such as MYR."));

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date.")
  .refine((value) => {
    const [year, month, day] = value.split("-").map(Number);
    if (!year || !month || !day) return false;
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  }, "Enter a real calendar date.");

export const maskedIdentifierSchema = z
  .string()
  .trim()
  .regex(/^(\d{4}|\*{1,4}\d{4})$/, "Use the last 4 digits or a mask like ****1234.")
  .refine((value) => !/^\d{13,19}$/.test(value), "Enter a mask, never a full card or account number.");

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : undefined));

export const createAccountSchema = z
  .object({
    type: z.enum(ACCOUNT_TYPES),
    displayName: z.string().trim().min(1).max(80),
    institution: optionalText(80),
    currency: currencySchema,
    maskedIdentifier: z.union([maskedIdentifierSchema, z.literal("")]).optional(),
  })
  .strict();

export const accountSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(ACCOUNT_TYPES),
  institution: z.string().nullable(),
  displayName: z.string(),
  currency: currencySchema,
  maskedIdentifier: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const createTransactionSchema = z
  .object({
    accountId: z.string().uuid(),
    transactionDate: isoDateSchema,
    postedDate: isoDateSchema.optional(),
    description: z.string().trim().min(1).max(500),
    merchantName: optionalText(120),
    amount: z.string().trim().min(1).max(20),
    currency: currencySchema,
    direction: z.enum(DIRECTIONS),
    transactionType: z.enum(TRANSACTION_TYPES),
  })
  .strict();

export const transactionSchema = z.object({
  id: z.string().uuid(),
  accountId: z.string().uuid(),
  statementId: z.string().uuid().nullable(),
  transactionDate: isoDateSchema,
  postedDate: isoDateSchema.nullable(),
  description: z.string(),
  merchantName: z.string().nullable(),
  amountMinor: z.number().int().nonnegative(),
  currency: currencySchema,
  direction: z.enum(DIRECTIONS),
  transactionType: z.enum(TRANSACTION_TYPES),
  categoryId: z.string().uuid().nullable(),
  status: z.enum(TRANSACTION_STATUSES),
  source: z.enum(TRANSACTION_SOURCES),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const userProfileSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  pictureUrl: z.string().nullable(),
});

export const sessionResponseSchema = z.object({
  user: userProfileSchema,
  csrfToken: z.string().min(1),
  gmailConnected: z.boolean(),
});

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type Account = z.infer<typeof accountSchema>;
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type Transaction = z.infer<typeof transactionSchema>;
export type UserProfile = z.infer<typeof userProfileSchema>;
export type SessionResponse = z.infer<typeof sessionResponseSchema>;
