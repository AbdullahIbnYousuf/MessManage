import { describe, expect, it, vi } from "vitest";
import Decimal from "decimal.js";
import { fetchMoneySummary } from "@/lib/queries/money";

function memberBalance(balance = "30.00") {
  return {
    userId: "member",
    name: "Member",
    avatarUrl: null,
    status: "active",
    meals: 12,
    balance: new Decimal(balance),
    breakdown: {
      bazarContributed: new Decimal("100.10"),
      maidPayments: new Decimal("0.20"),
      fridgePayments: new Decimal("0.30"),
      bulkPurchases: new Decimal("0.40"),
      mealCost: new Decimal("50.25"),
      maidCharge: new Decimal("10.25"),
      fridgeBillShare: new Decimal("5.25"),
      bulkAllocations: new Decimal("4.75"),
    },
  };
}

function monthResult(overrides?: { balance?: string; hasData?: boolean }) {
  return {
    members: [memberBalance(overrides?.balance)],
    mealRate: new Decimal("12.3456"),
    totalMonthBazar: new Decimal("100.10"),
    totalMonthMeals: 12,
    hasData: overrides?.hasData ?? true,
  };
}

function dependencies(options?: {
  currentBalance?: string;
  previousHasData?: boolean;
  issues?: string[];
  settlement?: Date | null;
}) {
  const fetchMonthBalances = vi.fn()
    .mockResolvedValueOnce(monthResult({ balance: options?.currentBalance }))
    .mockResolvedValueOnce(monthResult({ hasData: options?.previousHasData }));
  return {
    fetchMonthBalances,
    fetchSettlementReadiness: vi.fn().mockResolvedValue(options?.issues ?? []),
    findSettlement: vi.fn().mockResolvedValue(
      options?.settlement ? { settledAt: options.settlement } : null
    ),
    fetchDebtSummary: vi.fn().mockResolvedValue({
      youOwe: "10.00",
      owedToYou: "25.00",
      net: "15.00",
      pendingPaymentResponseCount: 1,
      pendingPaymentInitiatedCount: 2,
      pairwise: [
        { memberId: "a", memberName: "A", avatarUrl: null, position: "25.00", direction: "owes_you" },
        { memberId: "b", memberName: "B", avatarUrl: null, position: "-10.00", direction: "you_owe" },
      ],
      recentActivity: [],
    }),
    fetchDebtPayments: vi.fn().mockResolvedValue({
      entries: [{
        type: "payment",
        id: "payment",
        createdAt: "2026-08-01T00:00:00.000Z",
        amount: "10.00",
        description: null,
        status: "pending",
        source: "direct",
        reversesTransferId: null,
        rejectionReason: null,
        respondedAt: null,
        cancelledAt: null,
        initiatedBy: "sender",
        sender: { id: "a", name: "A", avatarUrl: null },
        receiver: { id: "member", name: "Member", avatarUrl: null },
      }],
      nextCursor: null,
    }),
  };
}

describe("fetchMoneySummary", () => {
  it("keeps current and confirmed money separate while preserving exact decimals", async () => {
    const deps = dependencies();
    const summary = await fetchMoneySummary({
      currentUserId: "member",
      confirmedMoneyEnabled: true,
      now: new Date("2026-08-06T06:00:00.000Z"),
      dependencies: deps as never,
    });

    expect(summary.currentMonth).toMatchObject({
      month: "2026-08",
      balance: "30.00",
      direction: "owed",
      credits: "101.00",
      costs: "70.50",
      totalMeals: 12,
      mealRate: "12.3456",
    });
    expect(summary.previousClosing).toEqual({
      month: "2026-07",
      status: "ready",
      settledAt: null,
      issues: [],
    });
    expect(summary.confirmedMoney).toMatchObject({
      youOwe: "10.00",
      owedToYou: "25.00",
      net: "15.00",
      pendingResponseCount: 1,
      pendingInitiatedCount: 2,
      pairwiseCount: 2,
    });
    expect(deps.fetchDebtPayments).toHaveBeenCalledWith({
      currentUserId: "member",
      action: "needs_response",
      status: "pending",
      limit: 3,
    });
  });

  it("does not query confirmed-money records when DebtSync is disabled", async () => {
    const deps = dependencies({ previousHasData: false, issues: ["ignored"] });
    const summary = await fetchMoneySummary({
      currentUserId: "member",
      confirmedMoneyEnabled: false,
      now: new Date("2026-08-06T06:00:00.000Z"),
      dependencies: deps as never,
    });

    expect(summary.previousClosing.status).toBe("no_activity");
    expect(summary.previousClosing.issues).toEqual([]);
    expect(summary.confirmedMoneyEnabled).toBe(false);
    expect(summary.confirmedMoney).toBeNull();
    expect(deps.fetchDebtSummary).not.toHaveBeenCalled();
    expect(deps.fetchDebtPayments).not.toHaveBeenCalled();
  });

  it("reports readiness issues without changing the current balance", async () => {
    const deps = dependencies({
      currentBalance: "-40.00",
      issues: ["Maid charges do not match payments."],
    });
    const summary = await fetchMoneySummary({
      currentUserId: "member",
      confirmedMoneyEnabled: false,
      now: new Date("2026-08-06T06:00:00.000Z"),
      dependencies: deps as never,
    });

    expect(summary.currentMonth).toMatchObject({ balance: "-40.00", direction: "owes" });
    expect(summary.previousClosing).toMatchObject({
      status: "blocked",
      issues: ["Maid charges do not match payments."],
    });
  });

  it("handles January boundaries and skips previous-month calculations after closing", async () => {
    const settledAt = new Date("2027-01-02T00:00:00.000Z");
    const deps = dependencies({ settlement: settledAt });
    const summary = await fetchMoneySummary({
      currentUserId: "member",
      confirmedMoneyEnabled: false,
      now: new Date("2027-01-15T06:00:00.000Z"),
      dependencies: deps as never,
    });

    expect(summary.currentMonth.month).toBe("2027-01");
    expect(summary.previousClosing).toEqual({
      month: "2026-12",
      status: "closed",
      settledAt: settledAt.toISOString(),
      issues: [],
    });
    expect(deps.fetchMonthBalances).toHaveBeenCalledOnce();
    expect(deps.fetchSettlementReadiness).not.toHaveBeenCalled();
  });
});
