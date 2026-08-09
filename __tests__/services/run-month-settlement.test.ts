import { Prisma } from "@prisma/client";
import Decimal from "decimal.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const transactionClient = {
    monthlySettlementRun: { findUnique: vi.fn(), create: vi.fn() },
    monthlySettlement: { create: vi.fn() },
    debtObligation: { create: vi.fn() },
    debtNotification: { create: vi.fn() },
  };
  return {
    transactionClient,
    findRun: vi.fn(),
    transaction: vi.fn(),
    fetchBalances: vi.fn(),
    fetchReadiness: vi.fn(),
    deliverNotifications: vi.fn(),
    persistNotifications: vi.fn(),
  };
});

vi.mock("@/lib/db", () => ({
  db: {
    monthlySettlementRun: { findUnique: mocks.findRun },
    $transaction: mocks.transaction,
  },
}));

vi.mock("@/lib/queries/balance", () => ({
  fetchMonthBalances: mocks.fetchBalances,
}));

vi.mock("@/lib/queries/settlement-readiness", () => ({
  fetchSettlementReadiness: mocks.fetchReadiness,
}));

vi.mock("@/lib/services/debts/notifications", () => ({
  deliverDebtNotifications: mocks.deliverNotifications,
  persistDebtNotifications: mocks.persistNotifications,
}));

import { runMonthSettlement } from "@/lib/services/run-month-settlement";

function balanceResult(firstBalance: string, secondBalance: string) {
  const emptyBreakdown = {
    bazarContributed: new Decimal(0),
    maidPayments: new Decimal(0),
    fridgePayments: new Decimal(0),
    bulkPurchases: new Decimal(0),
    mealCost: new Decimal(0),
    maidCharge: new Decimal(0),
    fridgeBillShare: new Decimal(0),
    bulkAllocations: new Decimal(0),
  };
  return {
    members: [
      {
        userId: "debtor",
        name: "Debtor",
        avatarUrl: null,
        status: "active",
        meals: 1,
        balance: new Decimal(firstBalance),
        breakdown: emptyBreakdown,
      },
      {
        userId: "creditor",
        name: "Creditor",
        avatarUrl: null,
        status: "active",
        meals: 1,
        balance: new Decimal(secondBalance),
        breakdown: emptyBreakdown,
      },
    ],
    mealRate: new Decimal(10),
    totalMonthBazar: new Decimal(20),
    totalMonthMeals: 2,
    hasData: true,
  };
}

describe("runMonthSettlement", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.findRun.mockResolvedValue(null);
    mocks.transactionClient.monthlySettlementRun.findUnique.mockResolvedValue(null);
    mocks.fetchReadiness.mockResolvedValue([]);
    mocks.fetchBalances.mockResolvedValue(balanceResult("-50.00", "50.00"));
    mocks.transactionClient.monthlySettlementRun.create.mockResolvedValue({ id: "run" });
    mocks.transactionClient.monthlySettlement.create.mockResolvedValue({ id: "settlement" });
    mocks.transactionClient.debtObligation.create.mockResolvedValue({ id: "obligation" });
    mocks.persistNotifications.mockResolvedValue([
      "notification-debtor",
      "notification-creditor",
    ]);
    mocks.transaction.mockImplementation(
      async (callback: (client: typeof mocks.transactionClient) => Promise<unknown>) =>
        callback(mocks.transactionClient)
    );
    mocks.deliverNotifications.mockResolvedValue(undefined);
  });

  it("creates the run, settlement, obligation, and both notifications atomically", async () => {
    const result = await runMonthSettlement({
      monthKey: "2026-07-01",
      trigger: "manual",
      actorId: "admin",
    });

    expect(result.status).toBe("completed");
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.transactionClient.monthlySettlementRun.create).toHaveBeenCalledTimes(1);
    expect(mocks.transactionClient.monthlySettlement.create).toHaveBeenCalledTimes(1);
    expect(mocks.transactionClient.debtObligation.create).toHaveBeenCalledTimes(1);
    expect(mocks.persistNotifications).toHaveBeenCalledTimes(1);
    expect(mocks.deliverNotifications).toHaveBeenCalledWith([
      "notification-debtor",
      "notification-creditor",
    ]);
  });

  it("commits a permanent run for a data-bearing zero-transfer month", async () => {
    mocks.fetchBalances.mockResolvedValue(balanceResult("0.00", "0.00"));

    const result = await runMonthSettlement({
      monthKey: "2026-07-01",
      trigger: "cron",
    });

    expect(result.status).toBe("completed");
    expect(mocks.transactionClient.monthlySettlementRun.create).toHaveBeenCalledTimes(1);
    expect(mocks.transactionClient.monthlySettlement.create).not.toHaveBeenCalled();
    expect(mocks.transactionClient.debtObligation.create).not.toHaveBeenCalled();
    expect(mocks.persistNotifications).not.toHaveBeenCalled();
  });

  it("returns already_settled without recalculating an existing month", async () => {
    mocks.transactionClient.monthlySettlementRun.findUnique.mockResolvedValue({ id: "existing-run" });

    const result = await runMonthSettlement({
      monthKey: "2026-07-01",
      trigger: "cron",
    });

    expect(result.status).toBe("already_settled");
    expect(mocks.fetchBalances).not.toHaveBeenCalled();
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
  });

  it("blocks current and future months before opening a transaction", async () => {
    const result = await runMonthSettlement({
      monthKey: "2026-08-01",
      trigger: "manual",
      actorId: "admin",
    });

    expect(result).toMatchObject({
      status: "blocked",
      code: "SETTLEMENT_MONTH_NOT_CLOSED",
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("blocks nonzero bazar spending when the month has zero meals", async () => {
    const resultWithNoMeals = balanceResult("0.00", "0.00");
    resultWithNoMeals.totalMonthMeals = 0;
    resultWithNoMeals.totalMonthBazar = new Decimal("100.00");
    mocks.fetchBalances.mockResolvedValue(resultWithNoMeals);

    const result = await runMonthSettlement({
      monthKey: "2026-07-01",
      trigger: "manual",
      actorId: "admin",
    });

    expect(result).toMatchObject({ status: "blocked" });
    expect(mocks.transactionClient.monthlySettlementRun.create).not.toHaveBeenCalled();
  });

  it("classifies a concurrent run-creation winner as already_settled", async () => {
    mocks.findRun.mockResolvedValue({ id: "winning-run" });
    mocks.transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique run month", {
        code: "P2002",
        clientVersion: "6.19.3",
        meta: { target: ["month"] },
      })
    );

    const result = await runMonthSettlement({
      monthKey: "2026-07-01",
      trigger: "cron",
    });

    expect(result.status).toBe("already_settled");
    expect(mocks.deliverNotifications).not.toHaveBeenCalled();
  });

  it("does not deliver notifications when an atomic persistence step fails", async () => {
    mocks.transactionClient.debtObligation.create.mockRejectedValue(
      new Error("obligation failed")
    );

    await expect(runMonthSettlement({
      monthKey: "2026-07-01",
      trigger: "cron",
    })).rejects.toThrow("obligation failed");
    expect(mocks.deliverNotifications).not.toHaveBeenCalled();
  });

  it("keeps a completed settlement successful when push delivery fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.deliverNotifications.mockRejectedValue(new Error("push unavailable"));

    const result = await runMonthSettlement({
      monthKey: "2026-07-01",
      trigger: "cron",
    });

    expect(result.status).toBe("completed");
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.deliverNotifications).toHaveBeenCalledTimes(1);
    errorSpy.mockRestore();
  });
});
