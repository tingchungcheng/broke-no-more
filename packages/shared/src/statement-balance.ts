const AMOUNT = /(?:RM|MYR)?\s*(\d{1,3}(?:,\d{3})+|\d+)\.(\d{2})/gi;

export type ClosingBalance = {
  amount: string;
};

function scoreLine(line: string): number {
  if (/previous|opening|minimum|credit limit|overdue|finance charge/i.test(line)) return 0;
  if (/total\s+current\s+balance/i.test(line)) return 4;
  if (/current\s+balance/i.test(line)) return 3;
  if (/total\s+balance/i.test(line)) return 3;
  if (/(?:statement|closing|new)\s+balance/i.test(line)) return 2;
  return 0;
}

export function closingBalanceFromText(text: string): ClosingBalance | null {
  let best: { score: number; amount: string } | null = null;
  for (const line of text.split(/\n+/)) {
    const score = scoreLine(line);
    if (score === 0) continue;
    const amounts = [...line.matchAll(AMOUNT)];
    const match = amounts[amounts.length - 1];
    if (!match?.[1] || !match[2]) continue;
    const amount = `${match[1].replace(/,/g, "")}.${match[2]}`;
    if (!best || score > best.score) best = { score, amount };
  }
  return best ? { amount: best.amount } : null;
}
