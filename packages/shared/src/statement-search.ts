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
  if (/[:(){}\\]/.test(keyword) || /[\u0000-\u001f]/.test(keyword)) return null;
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

export function statementSearchQuery(keywords: string[]): string {
  const phrases = keywords.map((keyword) => `"${keyword}"`).join(" OR ");
  return `(subject:statement OR subject:e-statement OR subject:estatement OR subject:e-stmt) (${phrases})`;
}

function containsPhrase(haystack: string, phrase: string): boolean {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:[^a-z0-9]|$)`, "i").test(
    haystack,
  );
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
