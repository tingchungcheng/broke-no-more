import { describe, expect, it } from "vitest";
import { addMoney, formatMinor, MoneyError, parseDecimalToMinor, subtractMoney } from "./money";

describe("money", () => {
  it("converts MYR 532.16 into minor units", () => {
    expect(parseDecimalToMinor("532.16", "MYR")).toBe(53216);
    expect(formatMinor(53216, "MYR")).toBe("MYR 532.16");
  });

  it("pads short fractions and accepts whole amounts", () => {
    expect(parseDecimalToMinor("532.1", "MYR")).toBe(53210);
    expect(parseDecimalToMinor("532", "MYR")).toBe(53200);
    expect(formatMinor(0, "MYR")).toBe("MYR 0.00");
  });

  it("keeps zero-decimal currencies whole", () => {
    expect(parseDecimalToMinor("1000", "JPY")).toBe(1000);
    expect(formatMinor(1000, "JPY")).toBe("JPY 1,000");
    expect(() => parseDecimalToMinor("100.0", "JPY")).toThrow(MoneyError);
  });

  it("rejects floats written as extra precision, signs, and separators", () => {
    expect(() => parseDecimalToMinor("10.999", "MYR")).toThrow(MoneyError);
    expect(() => parseDecimalToMinor("-5.00", "MYR")).toThrow(MoneyError);
    expect(() => parseDecimalToMinor("1,234.00", "MYR")).toThrow(MoneyError);
    expect(() => parseDecimalToMinor("1e2", "MYR")).toThrow(MoneyError);
  });

  it("refuses to mix currencies", () => {
    expect(() => addMoney({ amountMinor: 100, currency: "MYR" }, { amountMinor: 100, currency: "USD" })).toThrow(
      /different currencies/,
    );
    expect(addMoney({ amountMinor: 100, currency: "MYR" }, { amountMinor: 50, currency: "MYR" })).toEqual({
      amountMinor: 150,
      currency: "MYR",
    });
    expect(subtractMoney({ amountMinor: 100, currency: "MYR" }, { amountMinor: 40, currency: "MYR" }).amountMinor).toBe(
      60,
    );
  });
});
