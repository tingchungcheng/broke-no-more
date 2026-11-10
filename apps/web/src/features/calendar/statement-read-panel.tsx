import type { Account } from "@broke-no-more/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { ApiClientError } from "@/lib/api";

type SavedPassword = { id: string; label: string; accountId: string | null };

type ReadResult = {
  checked: number;
  filesStored: number;
  statementsImported: number;
  transactionsImported: number;
  locked: number;
  unrecognized: number;
  needsAccount: number;
};

export function StatementReadPanel({ keywords }: { keywords: string[] }) {
  const { api, me } = useAuth();
  const queryClient = useQueryClient();
  const accounts = useQuery({ queryKey: ["accounts"], queryFn: () => api<{ accounts: Account[] }>("/accounts") });
  const passwords = useQuery({
    queryKey: ["statement-passwords"],
    queryFn: () => api<{ passwords: SavedPassword[] }>("/statement-passwords"),
  });
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [accountsByLabel, setAccountsByLabel] = useState<Record<string, string>>({});
  const [pendingLabel, setPendingLabel] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function savedFor(label: string) {
    return passwords.data?.passwords.find((row) => row.label.toLowerCase() === label.toLowerCase());
  }

  return (
    <Card>
      <h2 className="font-serif text-2xl">Read statements</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        This downloads the PDF or CSV from a saved statement email and opens a locked PDF with the password you save for
        that keyword. The password stays on the server. Transactions are added only when the file is a supported table,
        and they stay in review.
      </p>
      {keywords.length === 0 ? <p className="mt-4 text-sm text-muted">Select a keyword above before saving a password.</p> : null}
      <div className="mt-4 space-y-4">
        {keywords.map((keyword) => {
          const saved = savedFor(keyword);
          const accountId = accountsByLabel[keyword] ?? saved?.accountId ?? "";
          return (
            <form
              key={keyword}
              className="grid gap-3 rounded-2xl border border-line p-3 sm:grid-cols-[1fr_1fr_auto]"
              onSubmit={(event) => {
                event.preventDefault();
                const password = drafts[keyword]?.trim() ?? "";
                if (!password) {
                  setError(`Enter the ${keyword} statement password.`);
                  return;
                }
                setPendingLabel(keyword);
                setError(null);
                void api("/statement-passwords", {
                  method: "PUT",
                  body: JSON.stringify({ label: keyword, password, accountId: accountId || null }),
                })
                  .then(async () => {
                    setDrafts((current) => ({ ...current, [keyword]: "" }));
                    setNotice(`${keyword} password saved.`);
                    await queryClient.invalidateQueries({ queryKey: ["statement-passwords"] });
                  })
                  .catch((caught: unknown) => {
                    setError(caught instanceof ApiClientError ? caught.message : "The password could not be saved.");
                  })
                  .finally(() => setPendingLabel(null));
              }}
            >
              <div className="space-y-2 sm:col-span-1">
                <Label htmlFor={`password-${keyword}`}>{keyword} password</Label>
                <Input
                  id={`password-${keyword}`}
                  type="password"
                  autoComplete="new-password"
                  value={drafts[keyword] ?? ""}
                  placeholder={saved ? "Saved. Enter a new one to replace it." : "Statement password"}
                  onChange={(event) => setDrafts((current) => ({ ...current, [keyword]: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`account-${keyword}`}>Account</Label>
                <select
                  id={`account-${keyword}`}
                  className="h-11 w-full rounded-2xl border border-line bg-paper px-3 text-sm"
                  value={accountId}
                  onChange={(event) => setAccountsByLabel((current) => ({ ...current, [keyword]: event.target.value }))}
                >
                  <option value="">Choose later</option>
                  {(accounts.data?.accounts ?? []).map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.displayName} · {account.currency}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <Button type="submit" variant="secondary" disabled={pendingLabel === keyword}>
                  {saved ? "Replace" : "Save"}
                </Button>
              </div>
            </form>
          );
        })}
      </div>
      <div className="mt-4">
        {me?.gmailConnected ? (
          <Button
            type="button"
            disabled={reading}
            onClick={() => {
              setReading(true);
              setError(null);
              setNotice(null);
              void api<ReadResult>("/gmail/read", { method: "POST" })
                .then(async (result) => {
                  setNotice(
                    `Checked ${result.checked}. Stored ${result.filesStored} files. Added ${result.transactionsImported} transactions from ${result.statementsImported} statements. ${result.locked} locked, ${result.unrecognized} unrecognized, ${result.needsAccount} need an account.`,
                  );
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
            {reading ? "Reading…" : "Read saved statements"}
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
    </Card>
  );
}
