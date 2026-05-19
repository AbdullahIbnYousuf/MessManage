/**
 * Tests for the bulk item domain logic.
 *
 * computeUserBulkAllocation() splits a bulk purchase cost across members
 * proportional to their meal count during the cycle period.
 */

import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import { computeUserBulkAllocation, validateBulkCost } from "@/lib/domain/bulk";

// ─── computeUserBulkAllocation ───────────────────────────────────────────────

describe("computeUserBulkAllocation", () => {
  it("returns zero when total meals is zero (edge case)", () => {
    const result = computeUserBulkAllocation(new Decimal("1400"), 0, 10);
    expect(result.toFixed(2)).toBe("0.00");
  });

  it("allocates full cost when user has all meals", () => {
    const result = computeUserBulkAllocation(new Decimal("1400"), 100, 100);
    expect(result.toFixed(2)).toBe("1400.00");
  });

  it("allocates zero when user has no meals", () => {
    const result = computeUserBulkAllocation(new Decimal("1400"), 100, 0);
    expect(result.toFixed(2)).toBe("0.00");
  });

  it("allocates proportionally", () => {
    // 1400 cost, 100 total meals, user has 25 meals → 350
    const result = computeUserBulkAllocation(new Decimal("1400"), 100, 25);
    expect(result.toFixed(2)).toBe("350.00");
  });

  it("handles non-round division precisely", () => {
    // 1400 / 176 total meals, user has 45 meals
    // cost_per_meal = 7.954545...
    // user_allocation = 7.954545... × 45 = 357.954545...
    const result = computeUserBulkAllocation(new Decimal("1400"), 176, 45);
    expect(result.toFixed(2)).toBe("357.95");
  });

  it("sum of all allocations equals total cost", () => {
    const totalCost = new Decimal("1400");
    const meals = [45, 43, 44, 44]; // 176 total
    const totalMeals = meals.reduce((a, b) => a + b, 0);

    const allocations = meals.map((m) =>
      computeUserBulkAllocation(totalCost, totalMeals, m)
    );

    const sum = allocations.reduce((s, a) => s.add(a), new Decimal(0));
    // Due to rounding, the sum might differ by a tiny fraction
    // but for these exact values it should be exact
    expect(sum.toFixed(2)).toBe("1400.00");
  });
});

// ─── validateBulkCost ────────────────────────────────────────────────────────

describe("validateBulkCost", () => {
  it("returns null for valid positive number", () => {
    expect(validateBulkCost(1400)).toBeNull();
  });

  it("returns null for valid positive string", () => {
    expect(validateBulkCost("1400.50")).toBeNull();
  });

  it("returns error for zero", () => {
    expect(validateBulkCost(0)).toBe("Cost must be a positive number.");
  });

  it("returns error for negative number", () => {
    expect(validateBulkCost(-100)).toBe("Cost must be a positive number.");
  });

  it("returns error for non-number types", () => {
    expect(validateBulkCost(null)).toBe("Cost must be a number.");
    expect(validateBulkCost(undefined)).toBe("Cost must be a number.");
    expect(validateBulkCost({})).toBe("Cost must be a number.");
    expect(validateBulkCost([])).toBe("Cost must be a number.");
    expect(validateBulkCost(true)).toBe("Cost must be a number.");
  });

  it("returns error for NaN string", () => {
    expect(validateBulkCost("abc")).toBe("Cost must be a positive number.");
  });
});
