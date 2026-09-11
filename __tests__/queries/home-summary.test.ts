import { describe, expect, it, vi } from "vitest";
import { fetchHomeSummary } from "@/lib/queries/home";
import type { ExpensesSummary } from "@/types/expenses";
import type { MoneySummary } from "@/types/money";

const now = new Date("2026-08-08T12:00:00.000Z");

function expenses(): ExpensesSummary {
  return {
    generatedAt: now.toISOString(),
    currentMonth: "2026-08",
    previousMonth: "2026-07",
    bulk: { itemCount: 0, activeCycleCount: 0, missingCycleCount: 0, activeCycles: [], missingItems: [] },
    maid: { month: "2026-08", status: "applied", chargeCount: 1, chargeTotal: "700.00", paymentCount: 0, paymentTotal: "0.00", defaultCharge: "700.00" },
    fridge: { month: "2026-07", status: "settled", billId: null, totalAmount: "0.00", paymentCount: 0, paymentTotal: "0.00", previousReading: null, currentReading: null, unitsUsed: null, memberCount: null },
  };
}

function money(): MoneySummary {
  return {
    generatedAt: now.toISOString(),
    currentMonth: {
      month: "2026-08",
      balance: "30.30",
      direction: "owed",
      credits: "100.30",
      costs: "70.00",
      totalMeals: 2,
      householdBazar: "100.30",
      householdMeals: 6,
      mealRate: "16.7167",
      hasData: true,
      breakdown: { bazarContributed: "100.30", maidPayments: "0.00", fridgePayments: "0.00", bulkPurchases: "0.00", mealCost: "70.00", maidCharge: "0.00", fridgeBillShare: "0.00", bulkAllocations: "0.00" },
    },
    previousClosing: { month: "2026-07", status: "closed", settledAt: now.toISOString(), issues: [] },
    confirmedMoneyEnabled: false,
    confirmedMoney: null,
  };
}

function client(overrides?: {
  records?: Array<{ userId: string; mealCount: number; isLocked: boolean }>;
  config?: unknown;
  editRequest?: { status: "pending" | "approved" | "rejected" | "expired" } | null;
}) {
  const config = overrides && "config" in overrides
    ? overrides.config
    : { mealDeadline: "22:00", activeTrip: null };
  return {
    user: {
      findMany: vi.fn().mockResolvedValue([
        { id: "other", name: "A Member", nickname: null, avatarUrl: null },
        { id: "current", name: "Current Member", nickname: "Current", avatarUrl: null },
      ]),
    },
    mealRecord: {
      findMany: vi.fn().mockResolvedValue(overrides?.records ?? [
        { userId: "current", mealCount: 0, isLocked: false },
      ]),
    },
    systemConfig: {
      findFirst: vi.fn().mockResolvedValue(config),
    },
    mealEditRequest: {
      findFirst: vi.fn().mockResolvedValue(overrides?.editRequest ?? null),
      findMany: vi.fn().mockResolvedValue([]),
    },
    membershipRequest: {
      count: vi.fn().mockResolvedValue(0),
    },
  };
}

function dependencies() {
  return {
    fetchExpensesSummary: vi.fn().mockResolvedValue(expenses()),
    fetchMoneySummary: vi.fn().mockResolvedValue(money()),
  };
}

describe("fetchHomeSummary", () => {
  it("reads today without creating records and distinguishes zero from missing", async () => {
    const db = client();
    const deps = dependencies();
    const summary = await fetchHomeSummary({
      currentUser: { id: "current", role: "member" },
      confirmedMoneyEnabled: false,
      client: db as never,
      now,
      dependencies: deps,
    });

    expect(summary.date).toBe("2026-08-08");
    expect(summary.meals).toMatchObject({
      deadline: "22:00",
      deadlinePassed: false,
      total: 0,
      missingRecordCount: 1,
      currentMember: {
        userId: "current",
        name: "Current",
        mealCount: 0,
        hasRecord: true,
        state: "editable",
      },
    });
    expect(summary.meals.members.map((member) => [member.userId, member.mealCount])).toEqual([
      ["current", 0],
      ["other", null],
    ]);
    expect(summary.month).toEqual({
      month: "2026-08",
      provisionalBalance: "30.30",
      direction: "owed",
      totalBazar: "100.30",
      totalMeals: 6,
      mealRate: "16.7167",
    });
    expect(db.mealRecord.findMany).toHaveBeenCalledOnce();
    expect(deps.fetchMoneySummary).toHaveBeenCalledWith({
      currentUserId: "current",
      confirmedMoneyEnabled: false,
      now,
    });
    expect(db.mealEditRequest.findMany).not.toHaveBeenCalled();
    expect(db.membershipRequest.count).not.toHaveBeenCalled();
  });

  it("uses the canonical fallback deadline and exposes approved edits after it", async () => {
    const summary = await fetchHomeSummary({
      currentUser: { id: "current", role: "member" },
      confirmedMoneyEnabled: false,
      client: client({ config: null, editRequest: { status: "approved" } }) as never,
      now: new Date("2026-08-08T16:00:00.000Z"),
      dependencies: dependencies(),
    });

    expect(summary.meals).toMatchObject({
      deadline: "22:00",
      deadlinePassed: true,
      currentMember: { state: "request_approved", editRequestStatus: "approved" },
    });
    expect(summary.attention[0]?.kind).toBe("meal_edit_approved");
  });

  it("returns active-trip assignment and admin counts from read-only queries", async () => {
    const db = client({
      config: {
        mealDeadline: "22:00",
        activeTrip: {
          id: "trip",
          status: "open",
          triggeredAt: now,
          shoppingNotes: "Rice",
          assignee1Id: "current",
          assignee2Id: null,
          assignee1: { id: "current", name: "Current Member", nickname: "Current", avatarUrl: null },
          assignee2: null,
        },
      },
    });
    db.mealEditRequest.findMany.mockResolvedValue([
      { id: "legacy", batchId: null },
      { id: "batch-item-1", batchId: "batch" },
      { id: "batch-item-2", batchId: "batch" },
    ]);
    db.membershipRequest.count.mockResolvedValue(1);

    const summary = await fetchHomeSummary({
      currentUser: { id: "current", role: "admin" },
      confirmedMoneyEnabled: false,
      client: db as never,
      now,
      dependencies: dependencies(),
    });

    expect(summary.bazar.activeTrip).toMatchObject({
      id: "trip",
      isCurrentUserAssigned: true,
      shoppingNotes: "Rice",
    });
    expect(summary.attention.map((item) => item.kind)).toEqual([
      "bazar_assignment",
      "admin_meal_edits",
      "admin_memberships",
    ]);
    expect(db.mealEditRequest.findMany).toHaveBeenCalledWith({
      where: { status: "pending" },
      select: { id: true, batchId: true },
    });
    expect(db.membershipRequest.count).toHaveBeenCalledWith({ where: { status: "pending" } });
  });
});
