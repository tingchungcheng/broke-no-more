export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MoneyError";
  }
}

export interface Money {
  amountMinor: number;
  currency: string;
}

const ZERO_DECIMAL = new Set(["JPY", "KRW", "VND"]);
const THREE_DECIMAL = new Set(["BHD", "KWD", "OMR"]);

export function minorExponent(currency: string): number {
  if (ZERO_DECIMAL.has(currency)) return 0;
  if (THREE_DECIMAL.has(currency)) return 3;
  return 2;
}

function assertSafeMinor(amountMinor: number): void {
  if (!Number.isSafeInteger(amountMinor)) {
    throw new MoneyError("Amount is too large.");
  }
}

export function parseDecimalToMinor(value: string, currency: string): number {
  const trimmed = value.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new MoneyError("Enter a positive decimal amount such as 12.50.");
  }

  const exponent = minorExponent(currency);
  const [whole, fraction = ""] = trimmed.split(".");
  if (fraction.length > exponent) {
    throw new MoneyError(
      exponent === 0
        ? `${currency} does not use decimal places.`
        : `${currency} allows at most ${exponent} decimal places.`,
    );
  }

  const wholeNumber = Number(whole);
  if (!Number.isSafeInteger(wholeNumber)) {
    throw new MoneyError("Amount is too large.");
  }

  const padded = fraction.padEnd(exponent, "0");
  const fractionNumber = padded ? Number(padded) : 0;
  const amountMinor = wholeNumber * 10 ** exponent + fractionNumber;
  assertSafeMinor(amountMinor);
  return amountMinor;
}

export function formatMinor(amountMinor: number, currency: string): string {
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) {
    throw new MoneyError("Amount must be a non-negative integer in minor units.");
  }

  const exponent = minorExponent(currency);
  const scale = 10 ** exponent;
  const whole = Math.floor(amountMinor / scale);
  const grouped = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (exponent === 0) return `${currency} ${grouped}`;
  const fraction = String(amountMinor % scale).padStart(exponent, "0");
  return `${currency} ${grouped}.${fraction}`;
}

export function addMoney(left: Money, right: Money): Money {
  if (left.currency !== right.currency) {
    throw new MoneyError("Cannot add amounts in different currencies.");
  }
  const amountMinor = left.amountMinor + right.amountMinor;
  assertSafeMinor(amountMinor);
  return { amountMinor, currency: left.currency };
}

export function subtractMoney(left: Money, right: Money): Money {
  if (left.currency !== right.currency) {
    throw new MoneyError("Cannot subtract amounts in different currencies.");
  }
  const amountMinor = left.amountMinor - right.amountMinor;
  if (amountMinor < 0) {
    throw new MoneyError("Subtraction would make the amount negative.");
  }
  assertSafeMinor(amountMinor);
  return { amountMinor, currency: left.currency };
}
