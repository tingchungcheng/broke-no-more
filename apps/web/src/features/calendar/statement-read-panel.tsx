import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { ApiClientError } from "@/lib/api";
import { ReadLoadingModal } from "./read-loading-modal";

type ReadResult = {
  checked: number;
  filesStored: number;
  statementsImported: number;
  transactionsImported: number;
  locked: number;
  rejected?: number;
  unrecognized: number;
  needsAccount: number;
};

function formatReadNotice(result: ReadResult): string {
  const lines: string[] = [`Looked at ${result.checked} saved statement email${result.checked === 1 ? "" : "s"} (up to 20 per run).`];
  if ((result.rejected ?? 0) > 0) {
    const count = result.rejected ?? 0;
    lines.push(
      `${count} PDF${count === 1 ? "" : "s"} matched an account, but the saved PDF password did not open ${count === 1 ? "it" : "them"}. Update that password on Accounts → Edit, then read again.`,
    );
  }
  if (result.locked > 0) {
    lines.push(
      `${result.locked} locked PDF${result.locked === 1 ? "" : "s"} could not be opened. On Accounts → Edit, add a phrase that appears in that email subject (for example Credit Card) and that account's PDF password, then read again. The calendar chip only finds the mail.`,
    );
  }
  if (result.needsAccount > 0) {
    lines.push(`${result.needsAccount} opened but need an account linked on that password.`);
  }
  if (result.unrecognized > 0) {
    lines.push(
      `${result.unrecognized} file${result.unrecognized === 1 ? "" : "s"} opened, but neither the table reader nor OpenAI returned rows to review.`,
    );
  }
  if (result.statementsImported > 0 || result.transactionsImported > 0) {
    lines.push(
      `Imported ${result.transactionsImported} transaction${result.transactionsImported === 1 ? "" : "s"} from ${result.statementsImported} statement${result.statementsImported === 1 ? "" : "s"}.`,
    );
  } else if (result.filesStored > 0 && result.locked === 0) {
    lines.push(`Stored ${result.filesStored} file${result.filesStored === 1 ? "" : "s"} for review.`);
  }
  if (result.checked > 0 && result.locked === 0 && result.filesStored === 0 && result.statementsImported === 0) {
    lines.push("Nothing was imported. Common causes: no PDF/CSV attachment, or the email only contains a link.");
  }
  return lines.join(" ");
}

export function StatementReadPanel() {
  const { api, me } = useAuth();
  const queryClient = useQueryClient();
  const [reading, setReading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <Card>
      <h2 className="font-serif text-2xl">Read statements</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        This downloads the PDF or CSV from a saved statement email. A locked PDF is opened with the password whose
        phrases appear in the email subject. Add those phrases and the password under{" "}
        <span className="text-ink">Accounts → Edit</span>. A known table is imported directly. An unfamiliar layout is
        sent to OpenAI only after the file is open. Imported rows stay in review.
      </p>
      <div className="mt-4">
        {me?.gmailConnected ? (
          <Button
            type="button"
            onClick={() => {
              setReading(true);
              setError(null);
              setNotice(null);
              void api<ReadResult>("/gmail/read", { method: "POST" })
                .then(async (result) => {
                  setNotice(formatReadNotice(result));
                  await queryClient.invalidateQueries({ queryKey: ["statements"] });
                  await queryClient.invalidateQueries({ queryKey: ["calendar"] });
                  await queryClient.invalidateQueries({ queryKey: ["transactions"] });
                })
                .catch((caught: unknown) => {
                  setError(caught instanceof ApiClientError ? caught.message : "The read did not finish.");
                })
                .finally(() => setReading(false));
            }}
          >
            Read saved statements
          </Button>
        ) : (
          <Link to="/settings/connections" className="text-sm text-moss">
            Connect Gmail before reading
          </Link>
        )}
      </div>
      {notice ? <p className="mt-3 text-sm">{notice}</p> : null}
      {error ? (
        <p className="mt-3 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
      {reading ? <ReadLoadingModal /> : null}
    </Card>
  );
}
