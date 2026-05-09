// Pure business logic for the Meal system.
// No HTTP, no database calls — just formulas and rule checks.

import Decimal from "decimal.js";
import { div } from "@/lib/utils/decimal";
import { getDayKey, remainingDaysInMonth, today } from "@/lib/utils/dates";
import type { MealPattern } from "@/types";

/**
 * Computes the meal rate for a month.
 * Meal Rate = Total BazarExpense.amount ÷ Total MealRecord.meal_count
 * Returns null if no meals have been taken yet (avoid division by zero).
 */
export function computeMealRate(
  totalBazarSpend: Decimal,
  totalMeals: number
): Decimal | null {
  if (totalMeals === 0) return null;
  return div(totalBazarSpend, totalMeals);
}

/**
 * Given a user's meal pattern and a date string, returns the default meal count for that day.
 */
export function mealCountFromPattern(pattern: MealPattern, dateStr: string): number {
  const dayKey = getDayKey(dateStr);
  return pattern[dayKey];
}

/**
 * Returns all future date strings in the current month (from today inclusive)
 * that should be updated when a user changes their meal pattern.
 */
export function futureDatesInCurrentMonth(): string[] {
  return remainingDaysInMonth();
}

/**
 * Returns the meal count to assign to a future date based on a new pattern.
 * This is called when a pattern change propagates to future records.
 */
export function applyPatternToDate(newPattern: MealPattern, dateStr: string): number {
  return mealCountFromPattern(newPattern, dateStr);
}

/**
 * Returns true if a meal record for the given date can be edited directly
 * (i.e., before the deadline, on today's date).
 */
export function canEditDirectly(
  recordDate: string,
  deadlinePassed: boolean
): boolean {
  if (recordDate > today()) return true; // future dates are always editable
  if (recordDate < today()) return false; // past dates are never editable
  return !deadlinePassed; // today is editable if deadline hasn't passed
}

/**
 * Returns true if a MealEditRequest can be submitted for the given record.
 * Requires: date is today AND deadline has passed AND record is not yet locked.
 */
export function canRequestEdit(
  recordDate: string,
  deadlinePassed: boolean,
  isLocked: boolean
): boolean {
  if (recordDate !== today()) return false;
  if (!deadlinePassed) return false; // no need to request — just edit directly
  if (isLocked) return false;        // midnight lock — no override ever
  return true;
}

/**
 * Returns true if the midnight cron should lock a record.
 * A record is lockable if its date is in the past and it is not already locked.
 */
export function shouldLockRecord(recordDate: string, isLocked: boolean): boolean {
  if (isLocked) return false;
  return recordDate < today();
}
