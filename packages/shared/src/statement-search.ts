export const MAX_ACCOUNT_STATEMENT_KEYWORDS = 3;

export const SUGGESTED_STATEMENT_KEYWORDS = [
  "RYT",
  "Hong Leong",
  "Moomoo",
  "Maybank",
  "CIMB",
  "Public Bank",
  "RHB",
  "GXBank",
  "Touch 'n Go",
] as const;

const STATEMENT_LANGUAGE =
  /(?:^|[^a-z0-9])(?:e-?statements?|e-?stmts?|statements?)(?:[^a-z0-9]|$)/i;
const NOT_A_STATEMENT =
  /(?:^|[^a-z0-9])(?:otp|one[- ]time|verification code|password|promotion|promo|newsletter|unsubscribe|marketing)(?:[^a-z0-9]|$)/i;

export function normalizeStatementKeyword(value: string): string | null {
  const keyword = value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^['"]+|['"]+$/g, "");
  if (keyword.length < 2 || keyword.length > 40) return null;
  if (/[:{}\\]/.test(keyword) || /[\u0000-\u001f]/.test(keyword)) return null;
  return keyword;
}

export function normalizeStatementKeywords(values: string[]): string[] {
  const seen = new Set<string>();
  const keywords: string[] = [];
  for (const value of values) {
    const keyword = normalizeStatementKeyword(value);
    if (!keyword) continue;
    const key = keyword.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    keywords.push(keyword);
    if (keywords.length === 12) break;
  }
  return keywords;
}

export function normalizeAccountStatementKeywords(values: string[]): string[] {
  return normalizeStatementKeywords(values).slice(0, MAX_ACCOUNT_STATEMENT_KEYWORDS);
}

export type StatementScanRange = {
  fromDate: string;
  toDate: string;
};

const MAX_SCAN_DAYS = 366;

export function monthDateBounds(month: string): StatementScanRange {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) throw new Error("Month must be YYYY-MM.");
  const year = Number(match[1]);
  const monthNumber = Number(match[2]);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const monthText = String(monthNumber).padStart(2, "0");
  return {
    fromDate: `${year}-${monthText}-01`,
    toDate: `${year}-${monthText}-${String(lastDay).padStart(2, "0")}`,
  };
}

export function validateStatementScanRange(fromDate: string, toDate: string): StatementScanRange {
  if (fromDate > toDate) throw new Error("The start date must be on or before the end date.");
  const start = Date.parse(`${fromDate}T12:00:00Z`);
  const end = Date.parse(`${toDate}T12:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) throw new Error("Use YYYY-MM-DD dates.");
  const spanDays = Math.floor((end - start) / 86_400_000) + 1;
  if (spanDays > MAX_SCAN_DAYS) throw new Error(`Choose a range of ${MAX_SCAN_DAYS} days or fewer.`);
  return { fromDate, toDate };
}

function gmailAfterDate(isoDate: string): string {
  return isoDate.replaceAll("-", "/");
}

function gmailBeforeExclusive(isoDate: string): string {
  const [yearText, monthText, dayText] = isoDate.split("-");
  const next = new Date(Date.UTC(Number(yearText), Number(monthText) - 1, Number(dayText) + 1));
  return `${next.getUTCFullYear()}/${String(next.getUTCMonth() + 1).padStart(2, "0")}/${String(next.getUTCDate()).padStart(2, "0")}`;
}

export function statementSearchQuery(keywords: string[], range: StatementScanRange): string {
  const phrases = keywords.map((keyword) => `"${keyword}"`).join(" OR ");
  const bounded = validateStatementScanRange(range.fromDate, range.toDate);
  return `(subject:statement OR subject:e-statement OR subject:estatement OR subject:e-stmt) (${phrases}) after:${gmailAfterDate(bounded.fromDate)} before:${gmailBeforeExclusive(bounded.toDate)}`;
}

export function receivedOnWithinRange(receivedOn: string, range: StatementScanRange): boolean {
  return receivedOn >= range.fromDate && receivedOn <= range.toDate;
}

function containsPhrase(haystack: string, phrase: string): boolean {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:[^a-z0-9]|$)`, "i").test(
    haystack,
  );
}

export type StatementPasswordChoice = {
  label: string;
  accountId: string | null;
};

export type RankedStatementAccount = {
  accountId: string | null;
  score: number;
  matchedLabels: string[];
};

function keywordVariants(label: string): string[] {
  const variants = [label];
  for (const match of label.matchAll(/\(([^)]+)\)/g)) {
    const inner = match[1]?.trim() ?? "";
    if (inner.length >= 2) variants.push(inner);
  }
  return variants;
}

export function rankStatementAccounts(subject: string, presets: StatementPasswordChoice[]): RankedStatementAccount[] {
  const groups = new Map<string, { accountId: string | null; labels: string[] }>();
  for (const preset of presets) {
    const key = preset.accountId ?? `label:${preset.label.toLowerCase()}`;
    const group = groups.get(key) ?? { accountId: preset.accountId, labels: [] };
    group.labels.push(preset.label);
    groups.set(key, group);
  }
  const ranked: RankedStatementAccount[] = [];
  for (const group of groups.values()) {
    const matchedLabels = group.labels.filter((label) => keywordVariants(label).some((variant) => containsPhrase(subject, variant)));
    if (matchedLabels.length === 0) continue;
    const score = matchedLabels.reduce((total, label) => total + label.length, 0);
    ranked.push({ accountId: group.accountId, score, matchedLabels });
  }
  return ranked.sort((left, right) => right.score - left.score || right.matchedLabels.length - left.matchedLabels.length);
}

export function messageIsStatement(input: {
  subject: string;
  from: string;
  keywords: string[];
}): {
  keep: boolean;
  matched: string[];
} {
  const subject = input.subject.trim();
  if (!STATEMENT_LANGUAGE.test(subject) || NOT_A_STATEMENT.test(subject))
    return { keep: false, matched: [] };
  const matched = input.keywords.filter(
    (keyword) =>
      containsPhrase(subject, keyword) || containsPhrase(input.from, keyword),
  );
  return { keep: matched.length > 0, matched };
}

export function receivedOnInMalaysia(epochMs: number): string | null {
  if (!Number.isFinite(epochMs)) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(epochMs));
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) return null;
  return `${year}-${month}-${day}`;
}
