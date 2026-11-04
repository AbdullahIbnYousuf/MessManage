import type { DebtClearance } from "@/types/debts";

export type UnfinishedMemberBulkCycle = {
  id: string;
  itemName: string;
  consumedMeals: boolean;
  purchasedByMember: boolean;
};

export type MemberDeactivationClearance = DebtClearance & {
  unfinishedBulkCycles: UnfinishedMemberBulkCycle[];
  unclosedMonths: string[];
  pendingMealCorrectionCount: number;
};

/** Date strings are Dhaka calendar days, not cycle-start timestamps. */
export function participatingBulkCycles(input: {
  userId: string;
  today: string;
  mealDates: string[];
  activeCycles: { id: string; itemName: string; startDate: string; purchasedById: string }[];
}): UnfinishedMemberBulkCycle[] {
  const recordedDates = input.mealDates.filter((date) => date <= input.today);
  return input.activeCycles.map((cycle) => ({
    id: cycle.id,
    itemName: cycle.itemName,
    purchasedByMember: cycle.purchasedById === input.userId,
    consumedMeals: recordedDates.some((date) => date >= cycle.startDate),
  })).filter((cycle) => cycle.consumedMeals || cycle.purchasedByMember);
}

/** Pure clearance policy; stored costs and balances are never modified. */
export function combineDeactivationClearance(
  debt: DebtClearance,
  household: {
    unfinishedBulkCycles: UnfinishedMemberBulkCycle[];
    activityMonths: string[];
    closedMonths: string[];
    pendingMealCorrectionCount: number;
  }
): MemberDeactivationClearance {
  const closed = new Set(household.closedMonths);
  const unclosedMonths = [...new Set(household.activityMonths)]
    .filter((month) => !closed.has(month)).sort();
  const unfinishedBulkCycles = household.unfinishedBulkCycles
    .filter((cycle) => cycle.consumedMeals || cycle.purchasedByMember)
    .sort((a, b) => a.itemName.localeCompare(b.itemName) || a.id.localeCompare(b.id));

  return {
    ...debt,
    unfinishedBulkCycles,
    unclosedMonths,
    pendingMealCorrectionCount: household.pendingMealCorrectionCount,
    canDeactivate: debt.canDeactivate
      && unfinishedBulkCycles.length === 0
      && unclosedMonths.length === 0
      && household.pendingMealCorrectionCount === 0,
  };
}
