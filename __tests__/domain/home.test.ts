import { describe, expect, it } from "vitest";
import { buildHomeAttention, getHomeMealState } from "@/lib/domain/home";
import type { ExpensesSummary } from "@/types/expenses";
import type { MoneySummary } from "@/types/money";

function expensesSummary(): ExpensesSummary {
  return {
    generatedAt: "2026-08-08T00:00:00.000Z",
    currentMonth: "2026-08",
    previousMonth: "2026-07",
    bulk: {
      itemCount: 2,
      activeCycleCount: 0,
      missingCycleCount: 2,
      activeCycles: [],
      missingItems: [],
    },
    maid: {
      month: "2026-08",
      status: "not_applied",
      chargeCount: 0,
      chargeTotal: "0.00",
      paymentCount: 0,
      paymentTotal: "0.00",
      defaultCharge: "700.00",
    },
    fridge: {
      month: "2026-07",
      status: "not_posted",
      billId: null,
      totalAmount: "0.00",
      paymentCount: 0,
      paymentTotal: "0.00",
      previousReading: null,
      currentReading: null,
      unitsUsed: null,
      memberCount: null,
    },
  };
}

function moneySummary(): MoneySummary {
  return {
    generatedAt: "2026-08-08T00:00:00.000Z",
    currentMonth: {
      month: "2026-08",
      balance: "10.10",
      direction: "owed",
      credits: "20.20",
      costs: "10.10",
      totalMeals: 2,
      householdBazar: "100.30",
      householdMeals: 8,
      mealRate: "12.5375",
      hasData: true,
      breakdown: {
        bazarContributed: "20.20",
        maidPayments: "0.00",
        fridgePayments: "0.00",
        bulkPurchases: "0.00",
        mealCost: "10.10",
        maidCharge: "0.00",
        fridgeBillShare: "0.00",
        bulkAllocations: "0.00",
      },
    },
    previousClosing: {
      month: "2026-07",
      status: "blocked",
      settledAt: null,
      issues: ["Fridge bill is missing."],
    },
    confirmedMoneyEnabled: true,
    confirmedMoney: {
      youOwe: "0.00",
      owedToYou: "0.00",
      net: "0.00",
      pairwiseCount: 0,
      pairwise: [],
      pendingResponseCount: 3,
      pendingInitiatedCount: 0,
      pendingResponses: [],
      recentActivity: [],
    },
  };
}

describe("Home domain", () => {
  it("derives every deadline-aware meal state without treating missing as zero", () => {
    expect(getHomeMealState({ hasRecord: false, isLocked: false, deadlinePassed: false, editRequestStatus: null })).toBe("missing");
    expect(getHomeMealState({ hasRecord: true, isLocked: false, deadlinePassed: false, editRequestStatus: null })).toBe("editable");
    expect(getHomeMealState({ hasRecord: true, isLocked: false, deadlinePassed: true, editRequestStatus: null })).toBe("request_required");
    expect(getHomeMealState({ hasRecord: true, isLocked: false, deadlinePassed: true, editRequestStatus: "pending" })).toBe("request_pending");
    expect(getHomeMealState({ hasRecord: true, isLocked: false, deadlinePassed: true, editRequestStatus: "approved" })).toBe("request_approved");
    expect(getHomeMealState({ hasRecord: true, isLocked: false, deadlinePassed: true, editRequestStatus: "rejected" })).toBe("request_rejected");
    expect(getHomeMealState({ hasRecord: true, isLocked: true, deadlinePassed: false, editRequestStatus: "approved" })).toBe("locked");
  });

  it("orders member actions before admin household reviews", () => {
    const attention = buildHomeAttention({
      isAdmin: true,
      mealState: "request_approved",
      isAssignedToBazar: true,
      pendingMealEditCount: 2,
      pendingMembershipCount: 1,
      expenses: expensesSummary(),
      money: moneySummary(),
    });

    expect(attention.map((item) => item.kind)).toEqual([
      "meal_edit_approved",
      "payment_response",
      "bazar_assignment",
      "admin_meal_edits",
      "admin_memberships",
      "closing_blocked",
      "bulk_cycle_missing",
      "fridge_bill_missing",
      "maid_not_applied",
    ]);
  });

  it("never exposes admin-only reviews to members", () => {
    const attention = buildHomeAttention({
      isAdmin: false,
      mealState: "editable",
      isAssignedToBazar: false,
      pendingMealEditCount: 9,
      pendingMembershipCount: 9,
      expenses: expensesSummary(),
      money: {
        ...moneySummary(),
        confirmedMoney: null,
        confirmedMoneyEnabled: false,
      },
    });

    expect(attention).toEqual([]);
  });
});
