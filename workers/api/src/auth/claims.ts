export class ClaimsError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "ClaimsError";
  }
}

const ISSUERS = new Set(["https://accounts.google.com", "accounts.google.com"]);

export type GoogleIdentity = {
  sub: string;
  email: string;
  name: string;
  pictureUrl: string | null;
};

export function assertGoogleIdentity(
  claims: {
    iss?: unknown;
    aud?: unknown;
    exp?: unknown;
    nonce?: unknown;
    sub?: unknown;
    email?: unknown;
    email_verified?: unknown;
    name?: unknown;
    picture?: unknown;
  },
  expected: { clientId: string; nonce: string; nowSeconds?: number },
): GoogleIdentity {
  const now = expected.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (typeof claims.iss !== "string" || !ISSUERS.has(claims.iss)) {
    throw new ClaimsError("invalid_issuer", "Google issuer was not recognized.");
  }

  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audiences.includes(expected.clientId)) {
    throw new ClaimsError("invalid_audience", "Google token audience did not match this app.");
  }
  if (typeof claims.exp !== "number" || claims.exp <= now) {
    throw new ClaimsError("expired", "Google token has expired.");
  }
  if (typeof claims.nonce !== "string" || claims.nonce !== expected.nonce) {
    throw new ClaimsError("invalid_nonce", "Google token nonce did not match this sign-in attempt.");
  }
  if (typeof claims.sub !== "string" || claims.sub.length === 0) {
    throw new ClaimsError("missing_sub", "Google token did not include a stable subject.");
  }
  if (claims.email_verified !== true || typeof claims.email !== "string" || !claims.email.includes("@")) {
    throw new ClaimsError("unverified_email", "A verified Google email is required.");
  }

  const name = typeof claims.name === "string" && claims.name.trim() ? claims.name.trim() : claims.email;
  const pictureUrl = typeof claims.picture === "string" && claims.picture.startsWith("https://") ? claims.picture : null;
  return { sub: claims.sub, email: claims.email, name, pictureUrl };
}
