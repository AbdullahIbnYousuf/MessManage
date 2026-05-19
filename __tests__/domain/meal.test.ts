/**
 * Tests for the meal domain logic.
 *
 * computeMealRate() is the core formula: total bazar spend ÷ total meals.
 * canEditDirectly() and canRequestEdit() enforce the deadline rules.
 * shouldLockRecord() controls the midnight cron locking logic.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Decimal from "decimal.js";
import {
  computeMealRate,
  mealCountFromPattern,
  canEditDirectly,
  canRequestEdit,
  shouldLockRecord,
} from "@/lib/domain/meal";
import type { MealPattern } from "@/types";

// ─── Mock today() so tests don't depend on real date ─────────────────────────

// The meal module imports `today` from dates.ts — we mock the whole module
vi.mock("@/lib/utils/dates", async () => {
  const actual = await vi.importActual("@/lib/utils/dates");
  return {
    ...actual,
    today: () => "2024-12-15",
    // getDayKey is used by mealCountFromPattern — use real implementation
  };
});

// ─── computeMealRate ─────────────────────────────────────────────────────────

describe("computeMealRate", () => {
  it("returns null when total meals is zero (avoids division by zero)", () => {
    const rate = computeMealRate(new Decimal("5000"), 0);
    expect(rate).toBeNull();
  });

  it("computes rate correctly for simple values", () => {
    // 10000 taka / 100 meals = 100 per meal
    const rate = computeMealRate(new Decimal("10000"), 100);
    expect(rate).not.toBeNull();
    expect(rate!.toFixed(2)).toBe("100.00");
  });

  it("computes rate correctly when bazar spend is zero", () => {
    const rate = computeMealRate(new Decimal("0"), 50);
    expect(rate).not.toBeNull();
    expect(rate!.toFixed(2)).toBe("0.00");
  });

  it("handles non-round division precisely", () => {
    // 1000 / 3 = 333.333...
    const rate = computeMealRate(new Decimal("1000"), 3);
    expect(rate).not.toBeNull();
    // Should not lose precision
    expect(rate!.toNumber()).toBeCloseTo(333.333, 2);
  });

  it("handles realistic household values", () => {
    // 15,191.50 taka total / 108 total meals
    const rate = computeMealRate(new Decimal("15191.50"), 108);
    expect(rate).not.toBeNull();
    expect(rate!.toFixed(2)).toBe("140.66");
  });
});

// ─── mealCountFromPattern ────────────────────────────────────────────────────

describe("mealCountFromPattern", () => {
  const pattern: MealPattern = {
    monday: 2,
    tuesday: 1,
    wednesday: 0,
    thursday: 1,
    friday: 3,
    saturday: 1,
    sunday: 0,
  };

  it("returns correct count for a Monday", () => {
    // 2024-12-16 is a Monday
    expect(mealCountFromPattern(pattern, "2024-12-16")).toBe(2);
  });

  it("returns correct count for a Wednesday (zero)", () => {
    // 2024-12-18 is a Wednesday
    expect(mealCountFromPattern(pattern, "2024-12-18")).toBe(0);
  });

  it("returns correct count for a Friday", () => {
    // 2024-12-20 is a Friday
    expect(mealCountFromPattern(pattern, "2024-12-20")).toBe(3);
  });

  it("returns correct count for a Sunday (zero)", () => {
    // 2024-12-15 is a Sunday
    expect(mealCountFromPattern(pattern, "2024-12-15")).toBe(0);
  });
});

// ─── canEditDirectly ─────────────────────────────────────────────────────────

describe("canEditDirectly", () => {
  // today() is mocked to return "2024-12-15"

  it("returns true for future dates regardless of deadline", () => {
    expect(canEditDirectly("2024-12-20", false)).toBe(true);
    expect(canEditDirectly("2024-12-20", true)).toBe(true);
  });

  it("returns false for past dates regardless of deadline", () => {
    expect(canEditDirectly("2024-12-10", false)).toBe(false);
    expect(canEditDirectly("2024-12-10", true)).toBe(false);
  });

  it("returns true for today when deadline has NOT passed", () => {
    expect(canEditDirectly("2024-12-15", false)).toBe(true);
  });

  it("returns false for today when deadline HAS passed", () => {
    expect(canEditDirectly("2024-12-15", true)).toBe(false);
  });
});

// ─── canRequestEdit ──────────────────────────────────────────────────────────

describe("canRequestEdit", () => {
  // today() is mocked to return "2024-12-15"

  it("returns true when: today + deadline passed + not locked", () => {
    expect(canRequestEdit("2024-12-15", true, false)).toBe(true);
  });

  it("returns false for future dates", () => {
    expect(canRequestEdit("2024-12-20", true, false)).toBe(false);
  });

  it("returns false for past dates", () => {
    expect(canRequestEdit("2024-12-10", true, false)).toBe(false);
  });

  it("returns false when deadline has NOT passed (just edit directly)", () => {
    expect(canRequestEdit("2024-12-15", false, false)).toBe(false);
  });

  it("returns false when record is locked (midnight lock — no override)", () => {
    expect(canRequestEdit("2024-12-15", true, true)).toBe(false);
  });
});

// ─── shouldLockRecord ────────────────────────────────────────────────────────

describe("shouldLockRecord", () => {
  // today() is mocked to return "2024-12-15"

  it("returns true for past unlocked records", () => {
    expect(shouldLockRecord("2024-12-14", false)).toBe(true);
  });

  it("returns false for past already-locked records", () => {
    expect(shouldLockRecord("2024-12-14", true)).toBe(false);
  });

  it("returns false for today's record (not past yet)", () => {
    expect(shouldLockRecord("2024-12-15", false)).toBe(false);
  });

  it("returns false for future records", () => {
    expect(shouldLockRecord("2024-12-20", false)).toBe(false);
  });
});
