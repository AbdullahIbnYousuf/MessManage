// Pure business logic for Maid charges and payments.
// No HTTP, no database calls.

import Decimal from "decimal.js";

/** First accounting month using previous-month maid service. */
export const DEFERRED_MAID_ACCOUNTING_START = new Date("2026-08-01T00:00:00.000Z");

/** Returns the service month charged in the supplied accounting month. */
export function maidServiceMonthForAccountingMonth(accountingMonth: Date): Date {
  return new Date(Date.UTC(
    accountingMonth.getUTCFullYear(),
    accountingMonth.getUTCMonth() - 1,
    1
  ));
}

export function usesDeferredMaidAccounting(accountingMonth: Date): boolean {
  return accountingMonth >= DEFERRED_MAID_ACCOUNTING_START;
}

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

/** A member is charged when they were active at any point in the month. */
export function isMemberEligibleForMaidCharge(
  joinedAt: Date,
  deactivatedAt: Date | null,
  monthStart: Date
): boolean {
  const nextMonthStart = new Date(Date.UTC(
    monthStart.getUTCFullYear(),
    monthStart.getUTCMonth() + 1,
    1
  ));

  return joinedAt < nextMonthStart
    && (deactivatedAt === null || deactivatedAt >= monthStart);
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
