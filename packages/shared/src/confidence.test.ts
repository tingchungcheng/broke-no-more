import { describe, expect, it } from "vitest";
import { rollupDayStatus, statusFromScore } from "./confidence";

describe("confidence status", () => {
  it("uses the score bands and lets a conflict override them", () => {
    expect(statusFromScore(85, false)).toBe("high");
    expect(statusFromScore(100, false)).toBe("high");
    expect(statusFromScore(84, false)).toBe("needs_review");
    expect(statusFromScore(50, false)).toBe("needs_review");
    expect(statusFromScore(49, false)).toBe("unverified");
    expect(statusFromScore(null, false)).toBe("unverified");
    expect(statusFromScore(100, true)).toBe("conflict");
  });

  it("shows the most serious status on a day", () => {
    expect(rollupDayStatus([])).toBeNull();
    expect(rollupDayStatus(["high", "needs_review"])).toBe("needs_review");
    expect(rollupDayStatus(["high", "needs_review", "unverified"])).toBe("unverified");
    expect(rollupDayStatus(["high", "conflict"])).toBe("conflict");
  });
});
