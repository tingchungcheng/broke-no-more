import { messageIsStatement, receivedOnInMalaysia, statementSearchQuery } from "@broke-no-more/shared";

export type DiscoveredStatement = {
  gmailMessageId: string;
  subject: string;
  sender: string;
  receivedOn: string;
  matchedKeywords: string[];
};

type GmailHeader = { name?: string; value?: string };
type GmailMessage = {
  id?: string;
  internalDate?: string;
  payload?: { headers?: GmailHeader[] };
};

function header(message: GmailMessage, name: string): string {
  const match = message.payload?.headers?.find((item) => item.name?.toLowerCase() === name.toLowerCase());
  return typeof match?.value === "string" ? match.value : "";
}

export async function scanStatementMessages(
  accessToken: string,
  keywords: string[],
): Promise<{ inspected: number; discovered: DiscoveredStatement[] }> {
  const discovered: DiscoveredStatement[] = [];
  let inspected = 0;
  let pageToken = "";

  for (let page = 0; page < 4; page += 1) {
    const url = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages");
    url.searchParams.set("q", statementSearchQuery(keywords));
    url.searchParams.set("maxResults", "25");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const listResponse = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` } });
    const list = (await listResponse.json().catch(() => null)) as {
      messages?: { id?: string }[];
      nextPageToken?: string;
    } | null;
    if (!listResponse.ok || !list) throw new Error("Gmail message list failed.");
    const ids = (list.messages ?? []).map((message) => message.id).filter((id): id is string => Boolean(id));

    for (const id of ids) {
      inspected += 1;
      try {
        const messageUrl = new URL(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(id)}`);
        messageUrl.searchParams.set("format", "metadata");
        messageUrl.searchParams.append("metadataHeaders", "Subject");
        messageUrl.searchParams.append("metadataHeaders", "From");
        const messageResponse = await fetch(messageUrl, { headers: { authorization: `Bearer ${accessToken}` } });
        const message = (await messageResponse.json().catch(() => null)) as GmailMessage | null;
        if (!messageResponse.ok || !message) continue;
        const subject = header(message, "Subject");
        const sender = header(message, "From");
        const decision = messageIsStatement({ subject, from: sender, keywords });
        const receivedOn = receivedOnInMalaysia(Number(message.internalDate));
        if (!decision.keep || !receivedOn) continue;
        discovered.push({
          gmailMessageId: id,
          subject: subject.slice(0, 300),
          sender: sender.slice(0, 300),
          receivedOn,
          matchedKeywords: decision.matched,
        });
      } catch {
        // One unreadable message must not fail the scan.
      }
    }

    pageToken = list.nextPageToken ?? "";
    if (!pageToken) break;
  }

  return { inspected, discovered };
}
