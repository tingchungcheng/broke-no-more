import { base64UrlToBytes } from "../auth/crypto";

export type MailAttachment = {
  filename: string;
  attachmentId: string;
};

type GmailPart = {
  filename?: string;
  mimeType?: string;
  body?: { attachmentId?: string; data?: string; size?: number };
  parts?: GmailPart[];
};

function walk(part: GmailPart | undefined, found: MailAttachment[]) {
  if (!part) return;
  const filename = part.filename?.trim() ?? "";
  const extension = filename.toLowerCase();
  if ((extension.endsWith(".pdf") || extension.endsWith(".csv")) && part.body?.attachmentId) {
    found.push({ filename, attachmentId: part.body.attachmentId });
  }
  for (const child of part.parts ?? []) walk(child, found);
}

export function findStatementAttachments(payload: GmailPart | undefined): MailAttachment[] {
  const found: MailAttachment[] = [];
  walk(payload, found);
  return found;
}

export async function downloadAttachment(accessToken: string, messageId: string, attachmentId: string): Promise<Uint8Array | null> {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`;
  const response = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` } });
  const payload = (await response.json().catch(() => null)) as { data?: string } | null;
  if (!response.ok || !payload?.data) return null;
  return base64UrlToBytes(payload.data);
}

export async function fetchMessagePayload(accessToken: string, messageId: string): Promise<GmailPart | null> {
  const url = new URL(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}`);
  url.searchParams.set("format", "full");
  const response = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` } });
  const payload = (await response.json().catch(() => null)) as { payload?: GmailPart } | null;
  if (!response.ok || !payload?.payload) return null;
  return payload.payload;
}
