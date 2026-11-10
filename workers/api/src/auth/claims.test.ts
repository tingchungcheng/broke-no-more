import { describe, expect, it } from "vitest";
import { assertGoogleIdentity, ClaimsError } from "./claims";

const base = {
  iss: "https://accounts.google.com",
  aud: "client-id",
  exp: 2_000,
  nonce: "nonce-1",
  sub: "1099",
  email: "casey@example.com",
  email_verified: true,
  name: "Casey Rahman",
  picture: "https://example.com/casey.png",
};

const expected = { clientId: "client-id", nonce: "nonce-1", nowSeconds: 1_000 };

describe("Google identity claims", () => {
  it("accepts a verified identity and drops non-https pictures", () => {
    expect(assertGoogleIdentity(base, expected)).toMatchObject({
      sub: "1099",
      email: "casey@example.com",
      name: "Casey Rahman",
      pictureUrl: "https://example.com/casey.png",
    });
    expect(assertGoogleIdentity({ ...base, picture: "http://example.com/casey.png" }, expected).pictureUrl).toBeNull();
  });

  it("rejects the wrong audience, a missing subject, and an unverified email", () => {
    expect(() => assertGoogleIdentity({ ...base, aud: "other-app" }, expected)).toThrow(ClaimsError);
    expect(() => assertGoogleIdentity({ ...base, sub: "" }, expected)).toThrow(/subject/);
    expect(() => assertGoogleIdentity({ ...base, email_verified: false }, expected)).toThrow(/verified/);
    expect(() => assertGoogleIdentity({ ...base, nonce: "other" }, expected)).toThrow(/nonce/);
    expect(() => assertGoogleIdentity({ ...base, exp: 500 }, expected)).toThrow(/expired/);
  });
});
