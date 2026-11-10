import { sql } from "drizzle-orm";
import { check, index, integer, pgTable, real, text, uniqueIndex } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  googleSub: text("google_sub").notNull().unique(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  pictureUrl: text("picture_url"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    csrfToken: text("csrf_token").notNull(),
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("sessions_user_id_idx").on(table.userId)],
);

export const oauthConnections = pgTable(
  "oauth_connections",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    status: text("status").notNull(),
    scopes: text("scopes"),
    encryptedRefreshToken: text("encrypted_refresh_token"),
    encryptionKeyVersion: text("encryption_key_version"),
    tokenExpiresAt: text("token_expires_at"),
    connectedAt: text("connected_at"),
    disconnectedAt: text("disconnected_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [uniqueIndex("oauth_connections_user_provider_unique").on(table.userId, table.provider)],
);

export const accounts = pgTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    institution: text("institution"),
    displayName: text("display_name").notNull(),
    currency: text("currency").notNull(),
    maskedIdentifier: text("masked_identifier"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("accounts_user_id_idx").on(table.userId)],
);

export const categories = pgTable(
  "categories",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kind: text("kind").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("categories_user_id_idx").on(table.userId)],
);

export const statements = pgTable(
  "statements",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: text("account_id").references(() => accounts.id, { onDelete: "set null" }),
    source: text("source").notNull(),
    status: text("status").notNull(),
    checksum: text("checksum"),
    originalFilename: text("original_filename"),
    storageKey: text("storage_key"),
    parserVersion: text("parser_version"),
    periodStart: text("period_start"),
    periodEnd: text("period_end"),
    errorCode: text("error_code"),
    gmailMessageId: text("gmail_message_id"),
    subject: text("subject"),
    sender: text("sender"),
    receivedOn: text("received_on"),
    matchedKeywords: text("matched_keywords"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("statements_user_id_idx").on(table.userId),
    uniqueIndex("statements_user_checksum_unique").on(table.userId, table.checksum),
    uniqueIndex("statements_user_gmail_message_unique").on(table.userId, table.gmailMessageId),
  ],
);

export const transactions = pgTable(
  "transactions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    statementId: text("statement_id").references(() => statements.id, { onDelete: "set null" }),
    transactionDate: text("transaction_date").notNull(),
    postedDate: text("posted_date"),
    descriptionRaw: text("description_raw").notNull(),
    descriptionNormalized: text("description_normalized").notNull(),
    merchantName: text("merchant_name"),
    amountMinor: integer("amount_minor").notNull(),
    currency: text("currency").notNull(),
    direction: text("direction").notNull(),
    transactionType: text("transaction_type").notNull(),
    categoryId: text("category_id").references(() => categories.id, { onDelete: "set null" }),
    status: text("status").notNull(),
    confidence: real("confidence"),
    source: text("source").notNull(),
    sourceReference: text("source_reference"),
    parserVersion: text("parser_version"),
    fingerprint: text("fingerprint"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("transactions_user_id_idx").on(table.userId),
    index("transactions_account_id_idx").on(table.accountId),
    check("transactions_amount_non_negative", sql`${table.amountMinor} >= 0`),
  ],
);

export const statementPasswords = pgTable(
  "statement_passwords",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    encryptedPassword: text("encrypted_password").notNull(),
    encryptionKeyVersion: text("encryption_key_version").notNull(),
    accountId: text("account_id").references(() => accounts.id, { onDelete: "set null" }),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("statement_passwords_user_id_idx").on(table.userId)],
);

export const syncJobs = pgTable(
  "sync_jobs",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    status: text("status").notNull(),
    checkpoint: text("checkpoint"),
    retryCount: integer("retry_count").notNull().default(0),
    errorCode: text("error_code"),
    startedAt: text("started_at"),
    finishedAt: text("finished_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("sync_jobs_user_id_idx").on(table.userId)],
);
