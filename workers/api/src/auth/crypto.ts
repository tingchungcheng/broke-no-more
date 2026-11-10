export function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

export function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const remainder = value.length % 4;
  const padded = value.replaceAll("-", "+").replaceAll("_", "/") + (remainder === 0 ? "" : "=".repeat(4 - remainder));
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function safeEqual(left: string, right: string): boolean {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  const length = Math.max(leftBytes.length, rightBytes.length);
  let difference = leftBytes.length === rightBytes.length ? 0 : 1;
  for (let index = 0; index < length; index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }
  return difference === 0;
}

async function hmacKey(secret: string) {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

export async function signValue(payload: object, secret: string): Promise<string> {
  const body = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await hmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return `${body}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

export class SignatureError extends Error {
  constructor() {
    super("Signature is invalid.");
    this.name = "SignatureError";
  }
}

export async function readSignedValue<T>(token: string, secret: string): Promise<T> {
  const separator = token.lastIndexOf(".");
  if (separator <= 0) throw new SignatureError();
  const body = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  const key = await hmacKey(secret);
  let signatureBytes: Uint8Array<ArrayBuffer>;
  try {
    signatureBytes = base64UrlToBytes(signature);
  } catch {
    throw new SignatureError();
  }
  const valid = await crypto.subtle.verify("HMAC", key, signatureBytes, new TextEncoder().encode(body));
  if (!valid) throw new SignatureError();
  try {
    return JSON.parse(new TextDecoder().decode(base64UrlToBytes(body))) as T;
  } catch {
    throw new SignatureError();
  }
}
