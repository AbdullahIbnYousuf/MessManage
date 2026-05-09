// All money arithmetic lives here. Never use +, -, *, / on monetary values directly.
// Always use these helpers or Decimal methods directly.

import Decimal from "decimal.js";

// Configure Decimal for financial precision
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export { Decimal };

export function toDecimal(value: string | number | Decimal): Decimal {
  return new Decimal(value.toString());
}

export function add(a: Decimal, b: Decimal): Decimal {
  return a.add(b);
}

export function subtract(a: Decimal, b: Decimal): Decimal {
  return a.sub(b);
}

export function multiply(a: Decimal, b: Decimal | number): Decimal {
  return a.mul(b.toString());
}

export function divide(a: Decimal, b: Decimal | number): Decimal {
  if (new Decimal(b.toString()).isZero()) return new Decimal(0);
  return a.div(b.toString());
}

/** Format a Decimal as a taka string for display e.g. "৳1,234.50" */
export function formatTaka(amount: Decimal): string {
  return `৳${amount.toFixed(2)}`;
}

/** Round to 2 decimal places for display */
export function round2(amount: Decimal): Decimal {
  return amount.toDecimalPlaces(2);
}
