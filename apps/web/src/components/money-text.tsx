import { formatMinor, type Direction } from "@broke-no-more/shared";
import { DIRECTION_LABELS } from "@broke-no-more/shared";

export function MoneyText({ amountMinor, currency, direction }: { amountMinor: number; currency: string; direction: Direction }) {
  return (
    <span className="tabular-nums">
      {formatMinor(amountMinor, currency)}
      <span className="ml-2 text-xs font-medium uppercase tracking-wide text-muted">{DIRECTION_LABELS[direction]}</span>
    </span>
  );
}
