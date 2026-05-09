// Pure business logic for Maid charges and payments.
// No HTTP, no database calls.

import Decimal from "decimal.js";

/**
 * Returns the maid charge amount for a given member for a given month.
 * Uses the default charge from SystemConfig.
 * Returns zero for deactivated members.
 */
export function computeMaidCharge(
  defaultCharge: Decimal,
  memberStatus: "active" | "deactivated"
): Decimal {
  if (memberStatus === "deactivated") return new Decimal(0);
  return defaultCharge;
}

/**
 * Validates a maid payment amount. Returns an error string or null.
 */
export function validateMaidPayment(amount: unknown): string | null {
  if (typeof amount !== "number" && typeof amount !== "string") {
    return "Amount must be a number.";
  }
  const num = Number(amount);
  if (isNaN(num) || num <= 0) {
    return "Amount must be a positive number.";
  }
  return null;
}
