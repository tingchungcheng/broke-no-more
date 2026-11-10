import { describe, expect, it } from "vitest";
import { assertDirectionMatchesType, DirectionError, normalizeDescription } from "./transactions";

describe("transaction rules", () => {
  it("normalizes descriptions without dropping the original words", () => {
    expect(normalizeDescription("  Grab   FOOD ")).toBe("grab food");
  });

  it("keeps expenses, income, and refunds on the matching direction", () => {
    expect(() => assertDirectionMatchesType("EXPENSE", "IN")).toThrow(DirectionError);
    expect(() => assertDirectionMatchesType("INCOME", "OUT")).toThrow(DirectionError);
    expect(() => assertDirectionMatchesType("REFUND", "OUT")).toThrow(DirectionError);
    expect(() => assertDirectionMatchesType("TRANSFER", "OUT")).not.toThrow();
    expect(() => assertDirectionMatchesType("REPAYMENT", "OUT")).not.toThrow();
  });
});
