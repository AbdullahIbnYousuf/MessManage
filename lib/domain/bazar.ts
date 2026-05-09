// Pure business logic for the Bazar system.
// No HTTP, no database calls — just rules and formulas.

import { today, isInCurrentMonth } from "@/lib/utils/dates";

/**
 * Returns the effective date for a bazar expense.
 * If the given date is in the current month, use it as-is.
 * If it's in a prior month, force today's date (per business rules).
 */
export function effectiveBazarDate(requestedDate: string): string {
  if (isInCurrentMonth(requestedDate)) {
    return requestedDate;
  }
  // Backdating to a prior month is not allowed — force today
  return today();
}

/**
 * Given a list of users with their expense counts, returns the two with
 * the lowest visit counts as the suggested assignees for a new bazar trip.
 * In case of tie, the order from the input array is preserved (first-come).
 */
export function suggestAssignees<T extends { id: string; visitCount: number }>(
  members: T[]
): [T | null, T | null] {
  if (members.length === 0) return [null, null];

  const sorted = [...members].sort((a, b) => a.visitCount - b.visitCount);
  return [sorted[0] ?? null, sorted[1] ?? null];
}

/**
 * Returns true if it is valid to open a new bazar trip.
 * Only one trip with status=open can exist at a time.
 */
export function canOpenTrip(hasOpenTrip: boolean): boolean {
  return !hasOpenTrip;
}

/**
 * Validates a bazar expense amount. Returns an error string or null.
 */
export function validateBazarAmount(amount: unknown): string | null {
  if (typeof amount !== "number" && typeof amount !== "string") {
    return "Amount must be a number.";
  }
  const num = Number(amount);
  if (isNaN(num) || num < 0) {
    return "Amount must be a non-negative number.";
  }
  return null;
}
