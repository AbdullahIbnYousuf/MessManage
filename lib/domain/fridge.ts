// Pure business logic for the Fridge system.
// No HTTP, no database calls — just formulas and rule checks.

import Decimal from "decimal.js";

/**
 * Computes the total bill amount from meter readings and unit price.
 * totalAmount = (currentReading - previousReading) * unitPrice
 */
export function computeTotalFromReadings(
  previousReading: Decimal,
  currentReading: Decimal,
  unitPrice: Decimal
): Decimal | null {
  if (currentReading.lt(previousReading)) return null; // invalid — current must be >= previous
  const units = currentReading.sub(previousReading);
  return units.mul(unitPrice);
}

export type FridgeAllocationAmount = {
  userId: string;
  amount: Decimal;
};

/**
 * A member shares a fridge bill when they were active at any point during the
 * calendar month covered by the bill.
 */
export function isMemberEligibleForFridgeBill(
  joinedAt: Date,
  deactivatedAt: Date | null,
  billMonthStart: Date
): boolean {
  const nextMonthStart = new Date(Date.UTC(
    billMonthStart.getUTCFullYear(),
    billMonthStart.getUTCMonth() + 1,
    1
  ));

  return joinedAt < nextMonthStart
    && (deactivatedAt === null || deactivatedAt >= billMonthStart);
}

/**
 * Splits a bill into exact two-decimal allocations whose sum equals the bill.
 * Any leftover paisa is assigned deterministically by sorted user id.
 */
export function computeFridgeAllocations(
  totalAmount: Decimal,
  userIds: string[]
): FridgeAllocationAmount[] {
  const sortedUserIds = [...new Set(userIds)].sort();
  if (sortedUserIds.length === 0) return [];

  const normalizedTotal = totalAmount.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const totalPaisa = normalizedTotal.mul(100);
  const basePaisa = totalPaisa.dividedToIntegerBy(sortedUserIds.length);
  const remainderCount = totalPaisa.mod(sortedUserIds.length).toNumber();

  return sortedUserIds.map((userId, index) => ({
    userId,
    amount: basePaisa.plus(index < remainderCount ? 1 : 0).div(100),
  }));
}
