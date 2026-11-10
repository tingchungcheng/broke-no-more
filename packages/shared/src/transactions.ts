import type { Direction, TransactionType } from "./constants";

export class DirectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DirectionError";
  }
}

export function normalizeDescription(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function assertDirectionMatchesType(type: TransactionType, direction: Direction): void {
  if (type === "EXPENSE" && direction !== "OUT") {
    throw new DirectionError("An expense is money out.");
  }
  if (type === "INCOME" && direction !== "IN") {
    throw new DirectionError("Income is money in.");
  }
  if (type === "REFUND" && direction !== "IN") {
    throw new DirectionError("A refund is money in.");
  }
}
