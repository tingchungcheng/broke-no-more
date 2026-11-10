import { base64UrlToBytes, bytesToBase64Url } from "./crypto";

export function decodeEncryptionKey(value: string | undefined): Uint8Array<ArrayBuffer> | null {
  if (!value) return null;
  try {
    const bytes = base64UrlToBytes(value);
    return bytes.byteLength === 32 ? bytes : null;
  } catch {
    return null;
  }
}

async function aesKey(keyBytes: Uint8Array<ArrayBuffer>, usage: "encrypt" | "decrypt") {
  return crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, [usage]);
}

export async function sealString(keyBytes: Uint8Array<ArrayBuffer>, plaintext: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await aesKey(keyBytes, "encrypt");
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plaintext));
  return `v1.${bytesToBase64Url(iv)}.${bytesToBase64Url(new Uint8Array(cipher))}`;
}

export async function openSeal(keyBytes: Uint8Array<ArrayBuffer>, sealed: string): Promise<string> {
  const [version, ivPart, cipherPart] = sealed.split(".");
  if (version !== "v1" || !ivPart || !cipherPart) throw new Error("Sealed value is invalid.");
  const key = await aesKey(keyBytes, "decrypt");
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64UrlToBytes(ivPart) },
    key,
    base64UrlToBytes(cipherPart),
  );
  return new TextDecoder().decode(plain);
}
