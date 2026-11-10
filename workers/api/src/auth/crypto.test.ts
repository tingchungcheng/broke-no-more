import { describe, expect, it } from "vitest";
import { readSignedValue, safeEqual, signValue, SignatureError } from "./crypto";

const secret = "test-session-secret-must-be-32chars-min";

describe("signed values", () => {
  it("round-trips a payload and rejects tampering", async () => {
    const token = await signValue({ hello: "ledger", n: 3 }, secret);
    await expect(readSignedValue(token, secret)).resolves.toEqual({ hello: "ledger", n: 3 });

    const tampered = `${token.slice(0, -4)}aaaa`;
    await expect(readSignedValue(tampered, secret)).rejects.toBeInstanceOf(SignatureError);
    await expect(readSignedValue(token, `${secret}-other`)).rejects.toBeInstanceOf(SignatureError);
  });

  it("compares strings without treating different lengths as equal", () => {
    expect(safeEqual("csrf-token", "csrf-token")).toBe(true);
    expect(safeEqual("csrf-token", "csrf-token-2")).toBe(false);
    expect(safeEqual("a", "b")).toBe(false);
  });
});
