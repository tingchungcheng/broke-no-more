import type { MonthlyCashFlow, NetWorthResult, SpendingSlice, Transaction } from "@broke-no-more/shared";
import { formatMinor, TRANSACTION_SOURCE_LABELS, TRANSACTION_TYPE_LABELS } from "@broke-no-more/shared";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { MoneyText } from "@/components/money-text";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { CashFlowCharts } from "./cash-flow-charts";

function formatSigned(amountMinor: number, currency: string): string {
  if (amountMinor < 0) return `-${formatMinor(Math.abs(amountMinor), currency)}`;
  return formatMinor(amountMinor, currency);
}

export function DashboardPage() {
  const { api, me } = useAuth();
  const transactions = useQuery({
    queryKey: ["transactions", 1],
    queryFn: () => api<{ transactions: Transaction[]; total: number }>("/transactions?page=1"),
  });
  const overview = useQuery({
    queryKey: ["analytics"],
    queryFn: () =>
      api<{
        cashFlow: {
          currency: string;
          currencies: string[];
          months: MonthlyCashFlow[];
          spending: SpendingSlice[];
          includesNeedsReview: boolean;
        };
        netWorth: NetWorthResult | null;
      }>("/analytics/overview"),
  });

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm uppercase tracking-[0.16em] text-moss">Overview</p>
        <h1 className="mt-2 font-serif text-4xl">Hello, {me?.user.name.split(" ")[0]}</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Figures below come from records in this workspace. Net worth uses the latest statement balance on each account.
          It is not a sum of transactions.
        </p>
      </div>
      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <p className="text-sm text-muted">Net worth</p>
          {overview.data?.netWorth ? (
            <>
              <p className="mt-3 font-serif text-3xl tabular-nums">
                {formatSigned(overview.data.netWorth.netMinor, overview.data.netWorth.currency)}
              </p>
              <p className="mt-2 text-sm text-muted">
                Assets {formatMinor(overview.data.netWorth.assetsMinor, overview.data.netWorth.currency)} minus
                liabilities {formatMinor(overview.data.netWorth.liabilitiesMinor, overview.data.netWorth.currency)}
                {overview.data.netWorth.asOfDate ? `, as of ${overview.data.netWorth.asOfDate}` : ""}. A credit card
                balance is what you owe.
              </p>
              {overview.data.netWorth.missingAccounts.length > 0 ? (
                <p className="mt-2 text-sm text-muted">
                  No statement balance yet for {overview.data.netWorth.missingAccounts.map((account) => account.displayName).join(", ")}.
                  Those accounts are left out.
                </p>
              ) : null}
            </>
          ) : (
            <>
              <p className="mt-3 font-serif text-3xl">Not calculated</p>
              <p className="mt-2 text-sm text-muted">
                A statement balance has not been read yet, so a number here would be a guess.
              </p>
            </>
          )}
        </Card>
        <Card>
          <p className="text-sm text-muted">Transactions</p>
          <p className="mt-3 font-serif text-3xl tabular-nums">{transactions.data?.total ?? "–"}</p>
          <Link to="/transactions" className="mt-3 inline-block text-sm text-moss">
            Record a transaction
          </Link>
        </Card>
      </section>
      {overview.data ? (
        <CashFlowCharts
          currencies={overview.data.cashFlow.currencies}
          months={overview.data.cashFlow.months}
          spending={overview.data.cashFlow.spending}
          includesNeedsReview={overview.data.cashFlow.includesNeedsReview}
        />
      ) : (
        <Card>
          <h2 className="font-serif text-2xl">Cash flow</h2>
          <p className="mt-2 text-sm text-muted">Loading the figures.</p>
        </Card>
      )}
      <Card className="border-dashed">
        <p className="font-medium">{me?.gmailConnected ? "Gmail is connected" : "Gmail is not connected"}</p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Signing in does not grant inbox access. Mailbox consent is separate. Statement search lives on the calendar
          and keeps only messages whose subject says they are statements.
        </p>
        <Link to="/calendar" className="mt-3 inline-block text-sm text-moss">
          Open the calendar
        </Link>
        <Link to="/settings/connections" className="mt-3 ml-4 inline-block text-sm text-moss">
          {me?.gmailConnected ? "Review the connection" : "Connect Gmail"}
        </Link>
      </Card>
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
                <MoneyText
                  amountMinor={transaction.amountMinor}
                  currency={transaction.currency}
                  direction={transaction.direction}
                  transactionType={transaction.transactionType}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
