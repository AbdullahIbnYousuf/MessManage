import { describe, expect, it } from "vitest";
import { combineDeactivationClearance, participatingBulkCycles } from "@/lib/domain/deactivation";
import type { DebtClearance } from "@/types/debts";

const clearDebt: DebtClearance = {
  youOwe: "0.00", owedToYou: "0.00", net: "0.00",
  pendingCount: 0, pendingPaymentCount: 0, pendingDebtRequestCount: 0,
  canDeactivate: true,
};
const clearHousehold = {
  unfinishedBulkCycles: [], activityMonths: [], closedMonths: [], pendingMealCorrectionCount: 0,
};
const gas = { id: "gas-cycle", itemName: "Gas", startDate: "2026-10-10", purchasedById: "other" };

describe("bulk-cycle departure participation", () => {
  it("blocks Siam's unfinished gas cycle even when his confirmed debt is zero", () => {
    const cycles = participatingBulkCycles({
      userId: "siam", today: "2026-11-03", mealDates: ["2026-10-12", "2026-10-30"], activeCycles: [gas],
    });
    expect(cycles).toEqual([{ id: gas.id, itemName: "Gas", consumedMeals: true, purchasedByMember: false }]);
    expect(combineDeactivationClearance(clearDebt, { ...clearHousehold, unfinishedBulkCycles: cycles }).canDeactivate).toBe(false);
  });

  it("includes meals on the cycle's starting calendar day and today", () => {
    for (const date of [gas.startDate, "2026-11-03"]) {
      expect(participatingBulkCycles({ userId: "siam", today: "2026-11-03", mealDates: [date], activeCycles: [gas] })).toHaveLength(1);
    }
  });

  it("ignores meals from before this cycle began", () => {
    expect(participatingBulkCycles({ userId: "siam", today: "2026-11-03", mealDates: ["2026-10-09"], activeCycles: [gas] })).toEqual([]);
  });

  it("does not count next-month and tomorrow's scheduled meals as consumed", () => {
    expect(participatingBulkCycles({ userId: "siam", today: "2026-11-03", mealDates: ["2026-11-04", "2026-12-01"], activeCycles: [gas] })).toEqual([]);
  });

  it("blocks the purchaser's unresolved contribution even if they ate no meals", () => {
    expect(participatingBulkCycles({ userId: "other", today: "2026-11-03", mealDates: [], activeCycles: [gas] }))
      .toEqual([{ id: gas.id, itemName: "Gas", consumedMeals: false, purchasedByMember: true }]);
  });

  it("does not block a non-purchaser without meals just because another cycle exists", () => {
    expect(participatingBulkCycles({ userId: "siam", today: "2026-11-03", mealDates: [], activeCycles: [gas] })).toEqual([]);
  });

  it("continues to block if one of multiple relevant cycles is still active", () => {
    const cycles = participatingBulkCycles({ userId: "siam", today: "2026-11-03", mealDates: ["2026-11-02"], activeCycles: [gas, { ...gas, id: "rice", itemName: "Rice" }] });
    expect(cycles).toHaveLength(2);
    expect(combineDeactivationClearance(clearDebt, { ...clearHousehold, unfinishedBulkCycles: cycles.slice(1) }).canDeactivate).toBe(false);
  });
});

describe("final household and money clearance", () => {
  it("allows a member with no unresolved activity", () => {
    expect(combineDeactivationClearance(clearDebt, clearHousehold)).toEqual({ ...clearDebt, unfinishedBulkCycles: [], unclosedMonths: [], pendingMealCorrectionCount: 0 });
  });

  it("blocks unclosed activity even when the provisional or confirmed net happens to be zero", () => {
    const result = combineDeactivationClearance(clearDebt, { ...clearHousehold, activityMonths: ["2026-10", "2026-11", "2026-10"] });
    expect(result.unclosedMonths).toEqual(["2026-10", "2026-11"]);
    expect(result.canDeactivate).toBe(false);
  });

  it("ignores months already closed, including closed months with zero transfers", () => {
    const result = combineDeactivationClearance(clearDebt, { ...clearHousehold, activityMonths: ["2026-10"], closedMonths: ["2026-10"] });
    expect(result.unclosedMonths).toEqual([]);
    expect(result.canDeactivate).toBe(true);
  });

  it("closing a month does not override an unfinished cycle or pending money", () => {
    const cycles = [{ id: gas.id, itemName: "Gas", consumedMeals: true, purchasedByMember: false }];
    expect(combineDeactivationClearance(clearDebt, { ...clearHousehold, activityMonths: ["2026-10"], closedMonths: ["2026-10"], unfinishedBulkCycles: cycles }).canDeactivate).toBe(false);
    expect(combineDeactivationClearance({ ...clearDebt, pendingCount: 1, pendingPaymentCount: 1, canDeactivate: false }, clearHousehold).canDeactivate).toBe(false);
  });

  it("preserves gross debt clearance even when opposing debts net to zero", () => {
    expect(combineDeactivationClearance({ ...clearDebt, youOwe: "100.00", owedToYou: "100.00", canDeactivate: false }, clearHousehold).canDeactivate).toBe(false);
  });

  it("blocks pending meal corrections until reviewed", () => {
    const result = combineDeactivationClearance(clearDebt, { ...clearHousehold, pendingMealCorrectionCount: 2 });
    expect(result.pendingMealCorrectionCount).toBe(2);
    expect(result.canDeactivate).toBe(false);
  });

  it("handles December/January and sorts/deduplicates the outstanding months", () => {
    const result = combineDeactivationClearance(clearDebt, { ...clearHousehold,
      activityMonths: ["2027-01", "2026-12", "2026-11", "2026-12"], closedMonths: ["2026-11"],
    });
    expect(result.unclosedMonths).toEqual(["2026-12", "2027-01"]);
  });

  it("never mutates the supplied debt, cycles, or accounting history", () => {
    const input = structuredClone({ debt: clearDebt, household: { ...clearHousehold, activityMonths: ["2026-11", "2026-10"] } });
    const original = structuredClone(input);
    combineDeactivationClearance(input.debt, input.household);
    expect(input).toEqual(original);
  });
});
