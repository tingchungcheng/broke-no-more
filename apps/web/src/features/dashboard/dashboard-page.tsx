import type { Account, Transaction } from "@broke-no-more/shared";
import { ACCOUNT_TYPE_LABELS, TRANSACTION_SOURCE_LABELS, TRANSACTION_TYPE_LABELS } from "@broke-no-more/shared";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { MoneyText } from "@/components/money-text";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";

export function DashboardPage() {
  const { api, me } = useAuth();
  const accounts = useQuery({ queryKey: ["accounts"], queryFn: () => api<{ accounts: Account[] }>("/accounts") });
  const transactions = useQuery({
    queryKey: ["transactions"],
    queryFn: () => api<{ transactions: Transaction[] }>("/transactions"),
  });

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm uppercase tracking-[0.16em] text-moss">Overview</p>
        <h1 className="mt-2 font-serif text-4xl">Hello, {me?.user.name.split(" ")[0]}</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Figures below come from records in this workspace. Net worth stays blank until a statement balance or a value
          you enter can support it.
        </p>
      </div>
      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <p className="text-sm text-muted">Net worth</p>
          <p className="mt-3 font-serif text-3xl">Not calculated</p>
          <p className="mt-2 text-sm text-muted">Statement balances are not imported in this version, so a number here would be a guess.</p>
        </Card>
        <Card>
          <p className="text-sm text-muted">Accounts</p>
          <p className="mt-3 font-serif text-3xl tabular-nums">{accounts.data?.accounts.length ?? "–"}</p>
          <Link to="/accounts" className="mt-3 inline-block text-sm text-moss">
            Add or review accounts
          </Link>
        </Card>
        <Card>
          <p className="text-sm text-muted">Transactions</p>
          <p className="mt-3 font-serif text-3xl tabular-nums">{transactions.data?.transactions.length ?? "–"}</p>
          <Link to="/transactions" className="mt-3 inline-block text-sm text-moss">
            Record a transaction
          </Link>
        </Card>
      </section>
      {!me?.gmailConnected ? (
        <Card className="border-dashed">
          <p className="font-medium">Gmail is not connected</p>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Signing in does not grant inbox access. Statement discovery will be a separate consent step. It is not
            available in this version.
          </p>
        </Card>
      ) : null}
      <section>
        <h2 className="font-serif text-2xl">Recent transactions</h2>
        {transactions.data && transactions.data.transactions.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            Nothing recorded yet.{" "}
            <Link to="/onboarding" className="text-moss">
              Start with an account
            </Link>
            .
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-line rounded-3xl border border-line bg-card">
            {transactions.data?.transactions.slice(0, 8).map((transaction) => (
              <li key={transaction.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">{transaction.description}</p>
                  <p className="text-sm text-muted">
                    {transaction.transactionDate} · {TRANSACTION_TYPE_LABELS[transaction.transactionType]} ·{" "}
                    {TRANSACTION_SOURCE_LABELS[transaction.source]}
                  </p>
                </div>
                <MoneyText amountMinor={transaction.amountMinor} currency={transaction.currency} direction={transaction.direction} />
              </li>
            ))}
          </ul>
        )}
      </section>
      {accounts.data && accounts.data.accounts.length > 0 ? (
        <section>
          <h2 className="font-serif text-2xl">Accounts</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {accounts.data.accounts.map((account) => (
              <li key={account.id} className="rounded-3xl border border-line bg-card px-4 py-3">
                <p className="font-medium">{account.displayName}</p>
                <p className="text-sm text-muted">
                  {ACCOUNT_TYPE_LABELS[account.type]} · {account.currency}
                  {account.maskedIdentifier ? ` · ${account.maskedIdentifier}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
