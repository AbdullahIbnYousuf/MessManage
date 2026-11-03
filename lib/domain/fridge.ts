// Pure business logic for the Fridge system.
// No HTTP, no database calls — just formulas and rule checks.

import Decimal from "decimal.js";
import { FinancialError } from "@/lib/domain/financial-errors";

/** Exact, nonnegative meter reading fitting Decimal(10, 2). */
export function parseInitialFridgeReading(value: unknown): Decimal {
  if (typeof value !== "string" || !/^\d{1,8}(\.\d{1,2})?$/.test(value.trim())) {
    throw new FinancialError("FRIDGE_READING_INVALID", "Enter a reading from 0 to 99999999.99, with at most two decimal places.");
  }
  return new Decimal(value.trim());
}

export function assertCanInitializeFridge(hasBill: boolean, hasInitialReading: boolean): void {
  if (hasBill) {
    throw new FinancialError("FRIDGE_BILL_EXISTS", "A bill already exists. Its ending reading is the next bill's starting reading.");
  }
  if (hasInitialReading) {
    throw new FinancialError("FRIDGE_INITIAL_READING_EXISTS", "The initial meter reading has already been saved.");
  }
}

/** The baseline is not a bill, and must never be used to bill an earlier month. */
export function resolveFridgePreviousReading(input: {
  billMonth: Date;
  lastReading: Decimal | null;
  initialReading: Decimal | null;
  initialMonth: Date | null;
  suppliedReading: Decimal | null;
}): Decimal | null {
  if (input.initialMonth && input.billMonth < input.initialMonth) {
    throw new FinancialError("FRIDGE_READING_NOT_STARTED", "Meter tracking starts in a later month. Add the next reading after that month ends.");
  }
  // Preserve legacy first-bill input, but a saved baseline is authoritative.
  return input.initialReading !== null
    ? input.lastReading ?? input.initialReading
    : input.suppliedReading ?? input.lastReading;
}

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
