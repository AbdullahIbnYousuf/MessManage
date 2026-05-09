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
