// Pure business logic for Bulk Items.
// No HTTP, no database calls.

import Decimal from "decimal.js";
import { div, mul } from "@/lib/utils/decimal";

/**
 * Calculates the allocation amount for a single user when a bulk cycle closes.
 *
 * Formula:
 *   cost_per_meal = totalCycleCost / totalMealsDuringCycle
 *   userAllocation = cost_per_meal * userMealsDuringCycle
 *
 * Returns Decimal(0) if totalMeals is 0 (edge case: no one ate during cycle).
 */
export function computeUserBulkAllocation(
  totalCycleCost: Decimal,
  totalMealsDuringCycle: number,
  userMealsDuringCycle: number
): Decimal {
  if (totalMealsDuringCycle === 0) return new Decimal(0);
  const costPerMeal = div(totalCycleCost, totalMealsDuringCycle);
  return mul(costPerMeal, userMealsDuringCycle);
}

export type BulkMealShare = {
  userId: string;
  meals: number;
};

export type BulkAllocationAmount = BulkMealShare & {
  amount: Decimal;
};

/**
 * Allocates a cycle cost in whole paisa using the largest-remainder method.
 * This preserves the meal-weighted formula while guaranteeing that the stored
 * two-decimal allocations add up to the cycle cost exactly.
 */
export function computeBulkAllocations(
  totalCycleCost: Decimal,
  shares: BulkMealShare[]
): BulkAllocationAmount[] {
  const positiveShares = shares.filter((share) => share.meals > 0);
  const totalMeals = positiveShares.reduce((total, share) => total + share.meals, 0);
  if (totalMeals === 0) return [];

  const totalPaisa = totalCycleCost
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    .mul(100)
    .toDecimalPlaces(0);

  const allocations = positiveShares.map((share) => {
    const exactPaisa = totalPaisa.mul(share.meals).div(totalMeals);
    const basePaisa = exactPaisa.floor();
    return {
      ...share,
      basePaisa,
      remainder: exactPaisa.sub(basePaisa),
    };
  });

  const allocatedPaisa = allocations.reduce(
    (total, allocation) => total.add(allocation.basePaisa),
    new Decimal(0)
  );
  const remainderPaisa = totalPaisa.sub(allocatedPaisa).toNumber();

  const remainderRecipients = [...allocations]
    .sort((a, b) => {
      const remainderOrder = b.remainder.cmp(a.remainder);
      return remainderOrder !== 0
        ? remainderOrder
        : a.userId.localeCompare(b.userId);
    })
    .slice(0, remainderPaisa)
    .map((allocation) => allocation.userId);
  const recipientIds = new Set(remainderRecipients);

  return allocations.map(({ userId, meals, basePaisa }) => ({
    userId,
    meals,
    amount: basePaisa.add(recipientIds.has(userId) ? 1 : 0).div(100),
  }));
}

/**
 * Validates a bulk cycle cost. Returns an error string or null.
 */
export function validateBulkCost(cost: unknown): string | null {
  if (typeof cost !== "number" && typeof cost !== "string") {
    return "Cost must be a number.";
  }
  const num = Number(cost);
  if (isNaN(num) || num <= 0) {
    return "Cost must be a positive number.";
  }
  return null;
}
