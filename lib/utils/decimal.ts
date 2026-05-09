// Decimal arithmetic helpers — all money math lives here.
// Uses decimal.js to avoid floating-point errors.
// Rule: NEVER use native +, -, *, / on monetary values.

import Decimal from "decimal.js";

// Configure global precision and rounding
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

/**
 * Add two monetary values.
 */
export function add(a: Decimal | string, b: Decimal | string): Decimal {
  return new Decimal(a).add(new Decimal(b));
}

/**
 * Subtract b from a.
 */
export function sub(a: Decimal | string, b: Decimal | string): Decimal {
  return new Decimal(a).sub(new Decimal(b));
}

/**
 * Multiply two values.
 */
export function mul(a: Decimal | string, b: Decimal | string | number): Decimal {
  return new Decimal(a).mul(new Decimal(b));
}

/**
 * Divide a by b. Throws if b is zero.
 */
export function div(a: Decimal | string, b: Decimal | string | number): Decimal {
  const divisor = new Decimal(b);
  if (divisor.isZero()) throw new Error("Division by zero");
  return new Decimal(a).div(divisor);
}

/**
 * Sum an array of Decimal values.
 */
export function sum(values: Array<Decimal | string>): Decimal {
  return values.reduce<Decimal>(
    (acc, val) => acc.add(new Decimal(val)),
    new Decimal(0)
  );
}

/**
 * Return the minimum of two Decimal values.
 */
export function minDecimal(a: Decimal, b: Decimal): Decimal {
  return a.lt(b) ? a : b;
}

/**
 * Returns true if value is zero.
 */
export function isZero(value: Decimal): boolean {
  return value.isZero();
}

/**
 * Format a Decimal as a currency string in Bangladeshi Taka.
 * e.g. 1234.50 → "৳1,234.50"
 */
export function formatTaka(value: Decimal | string | number): string {
  const d = new Decimal(value);
  const abs = d.abs().toFixed(2);
  // Add thousand separators
  const parts = abs.split(".");
  const intPart = parts[0]!.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const formatted = `${intPart}.${parts[1]}`;
  return d.isNegative() ? `-৳${formatted}` : `৳${formatted}`;
}

/**
 * Format a Decimal as a plain number string with 2 decimal places.
 * Use for API serialization.
 */
export function toApiString(value: Decimal): string {
  return value.toFixed(2);
}

/**
 * Parse a string from the API into a Decimal.
 */
export function fromApiString(value: string): Decimal {
  return new Decimal(value);
}
