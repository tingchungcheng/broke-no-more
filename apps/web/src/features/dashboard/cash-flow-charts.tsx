import { formatMinor, TRANSACTION_TYPE_LABELS, type MonthlyCashFlow, type SpendingSlice } from "@broke-no-more/shared";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/card";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function monthLabel(month: string): string {
  const [year, rawMonth] = month.split("-");
  const name = MONTHS[Number(rawMonth) - 1] ?? month;
  return `${name} ${year}`;
}

function amountLabel(amountMinor: number, currency: string): string {
  return formatMinor(amountMinor, currency);
}

export function CashFlowCharts({
  currencies,
  months,
  spending,
  includesNeedsReview,
}: {
  currencies: string[];
  months: MonthlyCashFlow[];
  spending: SpendingSlice[];
  includesNeedsReview: boolean;
}) {
  const currency = currencies[0] ?? "MYR";

  if (currencies.length === 0) {
    return (
      <Card>
        <h2 className="font-serif text-2xl">Cash flow</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Income, expenses, and refunds appear here, including statement rows that still need review. A card payment is a
          repayment, not income, so it stays off this chart.
        </p>
      </Card>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-serif text-2xl">Cash flow</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            {includesNeedsReview ? "Includes rows that still need review. " : ""}
            Transfers and repayments are omitted, including a payment onto a credit card. These bars are not net worth.
          </p>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
        <Card>
          <h3 className="font-medium">Money in and out</h3>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={months} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#ddd4c4" vertical={false} />
                <XAxis dataKey="month" tickFormatter={monthLabel} tick={{ fill: "#5f584f", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis
                  tickFormatter={(value: number) => amountLabel(value, currency).replace(`${currency} `, "")}
                  tick={{ fill: "#5f584f", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  width={72}
                />
                <Tooltip
                  formatter={(value, name) => [amountLabel(Number(value ?? 0), currency), name]}
                  labelFormatter={(label) => monthLabel(String(label))}
                />
                <Bar dataKey="moneyInMinor" name="Money in" fill="#1e5c45" radius={[6, 6, 0, 0]} />
                <Bar dataKey="moneyOutMinor" name="Money out" fill="#a85b32" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-3 space-y-1 text-sm text-muted">
            {months.map((point) => (
              <li key={point.month}>
                {monthLabel(point.month)}: {amountLabel(point.moneyInMinor, currency)} in, {amountLabel(point.moneyOutMinor, currency)} out
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <h3 className="font-medium">Spending by type</h3>
          {spending.length === 0 ? (
            <p className="mt-4 text-sm text-muted">No spending in {currency} yet.</p>
          ) : (
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={spending} layout="vertical" margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                  <CartesianGrid stroke="#ddd4c4" horizontal={false} />
                  <XAxis
                    type="number"
                    tickFormatter={(value: number) => amountLabel(value, currency).replace(`${currency} `, "")}
                    tick={{ fill: "#5f584f", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="transactionType"
                    tickFormatter={(value: string) => TRANSACTION_TYPE_LABELS[value as keyof typeof TRANSACTION_TYPE_LABELS] ?? value}
                    tick={{ fill: "#5f584f", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    width={88}
                  />
                  <Tooltip formatter={(value) => [amountLabel(Number(value ?? 0), currency), "Money out"]} />
                  <Bar dataKey="amountMinor" name="Money out" fill="#1e5c45" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>
    </section>
  );
}
