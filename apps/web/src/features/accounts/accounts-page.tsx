import {
  ACCOUNT_TYPE_LABELS,
  ACCOUNT_TYPES,
  type Account,
  type AccountType,
} from "@broke-no-more/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { ApiClientError } from "@/lib/api";

export function AccountsPage() {
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const accounts = useQuery({ queryKey: ["accounts"], queryFn: () => api<{ accounts: Account[] }>("/accounts") });
  const [type, setType] = useState<AccountType>("CASH");
  const [displayName, setDisplayName] = useState("");
  const [institution, setInstitution] = useState("");
  const [currency, setCurrency] = useState("MYR");
  const [maskedIdentifier, setMaskedIdentifier] = useState("");
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () =>
      api("/accounts", {
        method: "POST",
        body: JSON.stringify({
          type,
          displayName,
          institution: institution || undefined,
          currency,
          maskedIdentifier: maskedIdentifier || undefined,
        }),
      }),
    onSuccess: async () => {
      setDisplayName("");
      setInstitution("");
      setMaskedIdentifier("");
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
    onError: (caught) => setError(caught instanceof ApiClientError ? caught.message : "Could not save the account."),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/accounts/${id}`, { method: "DELETE" }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["accounts"] });
      await queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    create.mutate();
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
      <Card>
        <h1 className="font-serif text-3xl">Add an account</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          This is a label for money you track. It does not connect to a bank, and it does not store a full card number.
        </p>
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="displayName">Name</Label>
            <Input id="displayName" value={displayName} onChange={(event) => setDisplayName(event.target.value)} required maxLength={80} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="type">Type</Label>
            <select
              id="type"
              className="h-11 w-full rounded-2xl border border-line bg-paper px-3 text-sm"
              value={type}
              onChange={(event) => setType(event.target.value as AccountType)}
            >
              {ACCOUNT_TYPES.map((accountType) => (
                <option key={accountType} value={accountType}>
                  {ACCOUNT_TYPE_LABELS[accountType]}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="institution">Institution</Label>
              <Input id="institution" value={institution} onChange={(event) => setInstitution(event.target.value)} maxLength={80} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Input
                id="currency"
                value={currency}
                onChange={(event) => setCurrency(event.target.value.toUpperCase())}
                maxLength={3}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="mask">Masked identifier</Label>
            <Input
              id="mask"
              value={maskedIdentifier}
              onChange={(event) => setMaskedIdentifier(event.target.value)}
              placeholder="1234 or ****1234"
              maxLength={8}
            />
            <p className="text-xs text-muted">Last 4 digits, or a mask. Never a full card or account number.</p>
          </div>
          {error ? (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={create.isPending}>
            Save account
          </Button>
        </form>
      </Card>
      <section>
        <h2 className="font-serif text-3xl">Your accounts</h2>
        {accounts.data?.accounts.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            No accounts yet. Recording a transaction needs one.{" "}
            <Link className="text-moss" to="/transactions">
              Transactions
            </Link>
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {accounts.data?.accounts.map((account) => (
              <li key={account.id} className="flex items-start justify-between gap-4 rounded-3xl border border-line bg-card px-4 py-3">
                <div>
                  <p className="font-medium">{account.displayName}</p>
                  <p className="text-sm text-muted">
                    {ACCOUNT_TYPE_LABELS[account.type]} · {account.currency}
                    {account.institution ? ` · ${account.institution}` : ""}
                    {account.maskedIdentifier ? ` · ${account.maskedIdentifier}` : ""}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (window.confirm(`Remove ${account.displayName}? Transactions on it will be removed too.`)) {
                      remove.mutate(account.id);
                    }
                  }}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
