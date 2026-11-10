export const CONFIDENCE_STATUSES = ["high", "needs_review", "unverified", "conflict"] as const;

export type ConfidenceStatus = (typeof CONFIDENCE_STATUSES)[number];

const SEVERITY: Record<ConfidenceStatus, number> = {
  high: 0,
  needs_review: 1,
  unverified: 2,
  conflict: 3,
};

export function statusFromScore(score: number | null, conflict: boolean): ConfidenceStatus {
  if (conflict) return "conflict";
  if (score == null || !Number.isFinite(score)) return "unverified";
  if (score >= 85) return "high";
  if (score >= 50) return "needs_review";
  return "unverified";
}

export function rollupDayStatus(statuses: ConfidenceStatus[]): ConfidenceStatus | null {
  if (statuses.length === 0) return null;
  return statuses.reduce((worst, status) => (SEVERITY[status] > SEVERITY[worst] ? status : worst));
}
