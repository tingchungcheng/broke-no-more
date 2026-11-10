import {
  DIRECTIONS,
  TRANSACTION_TYPE_LABELS,
  TRANSACTION_TYPES,
  TRANSACTION_SOURCE_LABELS,
  type Account,
  type Direction,
  type Transaction,
  type TransactionType,
} from "@broke-no-more/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { MoneyText } from "@/components/money-text";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { ApiClientError } from "@/lib/api";
import { todayInputValue } from "@/lib/utils";

export function TransactionsPage() {
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const accounts = useQuery({ queryKey: ["accounts"], queryFn: () => api<{ accounts: Account[] }>("/accounts") });
  const transactions = useQuery({
    queryKey: ["transactions", page],
    queryFn: () =>
      api<{ transactions: Transaction[]; page: number; pageSize: number; total: number; pageCount: number; hasMore: boolean }>(
        `/transactions?page=${page}`,
      ),
  });
  const [accountId, setAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [transactionDate, setTransactionDate] = useState(todayInputValue);
  const [description, setDescription] = useState("");
  const [merchantName, setMerchantName] = useState("");
  const [direction, setDirection] = useState<Direction>("OUT");
  const [transactionType, setTransactionType] = useState<TransactionType>("EXPENSE");
  const [error, setError] = useState<string | null>(null);

  const selected = accounts.data?.accounts.find((account) => account.id === accountId) ?? accounts.data?.accounts[0];
  const resolvedAccountId = accountId || selected?.id || "";

  const create = useMutation({
    mutationFn: () =>
      api("/transactions", {
        method: "POST",
        body: JSON.stringify({
          accountId: resolvedAccountId,
          transactionDate,
          description,
          merchantName: merchantName || undefined,
          amount,
          currency: selected?.currency ?? "MYR",
          direction,
          transactionType,
        }),
      }),
    onSuccess: async () => {
      setAmount("");
      setDescription("");
      setMerchantName("");
      setError(null);
      setPage(1);
      await queryClient.invalidateQueries({ queryKey: ["transactions"] });
      await queryClient.invalidateQueries({ queryKey: ["analytics"] });
    },
    onError: (caught) => setError(caught instanceof ApiClientError ? caught.message : "Could not save the transaction."),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/transactions/${id}`, { method: "DELETE" }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["transactions"] });
      await queryClient.invalidateQueries({ queryKey: ["analytics"] });
    },
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    create.mutate();
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
      <Card>
        <h1 className="font-serif text-3xl">Record a transaction</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Amounts are stored as whole minor units. A transfer or repayment is not treated as spending.
        </p>
        {!selected ? (
          <p className="mt-6 text-sm">
            Add an account first. <Link className="text-moss" to="/accounts">Go to accounts</Link>
          </p>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="account">Account</Label>
              <select
                id="account"
                className="h-11 w-full rounded-2xl border border-line bg-paper px-3 text-sm"
                value={resolvedAccountId}
                onChange={(event) => setAccountId(event.target.value)}
              >
                {accounts.data?.accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.displayName} · {account.currency}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount ({selected.currency})</Label>
                <Input id="amount" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} required placeholder="12.50" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input id="date" type="date" value={transactionDate} onChange={(event) => setTransactionDate(event.target.value)} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input id="description" value={description} onChange={(event) => setDescription(event.target.value)} required maxLength={500} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="merchant">Merchant or payee</Label>
              <Input id="merchant" value={merchantName} onChange={(event) => setMerchantName(event.target.value)} maxLength={120} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="direction">Direction</Label>
                <select
                  id="direction"
                  className="h-11 w-full rounded-2xl border border-line bg-paper px-3 text-sm"
                  value={direction}
                  onChange={(event) => setDirection(event.target.value as Direction)}
                >
                  {DIRECTIONS.map((item) => (
                    <option key={item} value={item}>
                      {item === "OUT" ? "Out" : "In"}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="kind">Type</Label>
                <select
                  id="kind"
                  className="h-11 w-full rounded-2xl border border-line bg-paper px-3 text-sm"
                  value={transactionType}
                  onChange={(event) => setTransactionType(event.target.value as TransactionType)}
                >
                  {TRANSACTION_TYPES.map((item) => (
                    <option key={item} value={item}>
                      {TRANSACTION_TYPE_LABELS[item]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {error ? (
              <p className="text-sm text-danger" role="alert">
                {error}
              </p>
            ) : null}
            <Button type="submit" disabled={create.isPending}>
              Save transaction
            </Button>
          </form>
        )}
      </Card>
      <section>
        <h2 className="font-serif text-3xl">Ledger</h2>
        <p className="mt-2 text-sm text-muted">
          A repayment is a payment onto that account, such as paying a credit card. It is not income, and it is left out
          of cash flow.
        </p>
        {transactions.data?.total === 0 ? (
          <p className="mt-4 text-sm text-muted">No transactions yet.</p>
        ) : (
          <>
          <p className="mt-4 text-sm text-muted">
            Showing{" "}
            {transactions.data
              ? `${(transactions.data.page - 1) * transactions.data.pageSize + 1}–${Math.min(transactions.data.page * transactions.data.pageSize, transactions.data.total)} of ${transactions.data.total}`
              : "…"}
          </p>
          <ul className="mt-4 divide-y divide-line rounded-3xl border border-line bg-card">
            {transactions.data?.transactions.map((transaction) => (
              <li key={transaction.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">{transaction.description}</p>
                  <p className="text-sm text-muted">
                    {transaction.transactionDate} · {TRANSACTION_TYPE_LABELS[transaction.transactionType]} ·{" "}
                    {TRANSACTION_SOURCE_LABELS[transaction.source]}
                    {transaction.merchantName ? ` · ${transaction.merchantName}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <MoneyText
                    amountMinor={transaction.amountMinor}
                    currency={transaction.currency}
                    direction={transaction.direction}
                    transactionType={transaction.transactionType}
                  />
                  <Button type="button" variant="ghost" size="sm" onClick={() => remove.mutate(transaction.id)}>
                    Remove
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          {(transactions.data?.pageCount ?? 0) > 1 ? (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button type="button" variant="secondary" size="sm" disabled={page <= 1 || transactions.isFetching} onClick={() => setPage((value) => Math.max(1, value - 1))}>
                Previous
              </Button>
              <span className="text-sm tabular-nums text-muted">
                Page {transactions.data?.page ?? page} of {transactions.data?.pageCount ?? 1}
              </span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={!transactions.data?.hasMore || transactions.isFetching}
                onClick={() => setPage((value) => value + 1)}
              >
                Next
              </Button>
            </div>
          ) : null}
          </>
        )}
      </section>
    </div>
  );
}
