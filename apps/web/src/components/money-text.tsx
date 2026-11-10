import { formatMinor, type Direction } from "@broke-no-more/shared";
import { DIRECTION_LABELS } from "@broke-no-more/shared";

export function MoneyText({
  amountMinor,
  currency,
  direction,
  transactionType,
}: {
  amountMinor: number;
  currency: string;
  direction: Direction;
  transactionType?: string;
}) {
  const label = transactionType === "REPAYMENT" ? "Repayment" : DIRECTION_LABELS[direction];
  return (
    <span className="tabular-nums">
      {formatMinor(amountMinor, currency)}
      <span className="ml-2 text-xs font-medium uppercase tracking-wide text-muted">{label}</span>
    </span>
  );
}
