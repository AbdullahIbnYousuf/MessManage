import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const tx = {
    user: { findUnique: vi.fn() },
    monthlySettlementRun: { findUnique: vi.fn() },
    systemConfig: { findFirst: vi.fn() },
    mealEditRequest: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      createMany: vi.fn(),
      updateMany: vi.fn(),
    },
    bulkCycle: { findMany: vi.fn() },
    mealRecord: {
      findMany: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
  };
  return { tx, serializable: vi.fn() };
});

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/services/debts/transactions", () => ({
  withSerializableRetry: mocks.serializable,
}));
vi.mock("@/lib/utils/dates", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/utils/dates")>();
  return {
    ...actual,
    getNow: () => new Date("2026-09-11T06:00:00.000Z"),
    today: () => "2026-09-11",
  };
});

import {
  invalidatePendingMealCorrectionsForRange,
  respondToMealEditReview,
  submitMealCorrectionBatch,
} from "@/lib/services/meal-corrections";

function requestItem(overrides: Record<string, unknown> = {}) {
  return {
    id: "item-1",
    userId: "member",
    mealRecordId: "record-1",
    batchId: "batch-1",
    targetDate: new Date("2026-08-05T00:00:00.000Z"),
    originalMealCount: 2,
    proposedMealCount: 1,
    status: "pending",
    requestedAt: new Date("2026-09-11T06:00:00.000Z"),
    reviewedAt: null,
    reviewedById: null,
    mealRecord: null,
    ...overrides,
  };
}

describe("batch meal correction commands", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.serializable.mockImplementation(
      (operation: (client: typeof mocks.tx) => Promise<unknown>) => operation(mocks.tx)
    );
    mocks.tx.user.findUnique.mockResolvedValue({
      joinedAt: new Date("2026-01-01T00:00:00.000Z"),
      deactivatedAt: null,
    });
    mocks.tx.monthlySettlementRun.findUnique.mockResolvedValue(null);
    mocks.tx.systemConfig.findFirst.mockResolvedValue({ mealDeadline: "22:00" });
    mocks.tx.mealEditRequest.findFirst.mockResolvedValue(null);
    mocks.tx.mealEditRequest.createMany.mockResolvedValue({ count: 2 });
    mocks.tx.mealEditRequest.updateMany.mockResolvedValue({ count: 2 });
    mocks.tx.bulkCycle.findMany.mockResolvedValue([]);
    mocks.tx.mealRecord.findMany.mockResolvedValue([
      {
        id: "record-1",
        userId: "member",
        date: new Date("2026-08-05T00:00:00.000Z"),
        mealCount: 2,
        isLocked: true,
      },
      {
        id: "record-2",
        userId: "member",
        date: new Date("2026-08-06T00:00:00.000Z"),
        mealCount: 1,
        isLocked: true,
      },
    ]);
  });

  it("submits exact before/after items without changing meal records", async () => {
    mocks.tx.mealEditRequest.findMany.mockImplementation(async () => {
      const data = mocks.tx.mealEditRequest.createMany.mock.calls[0]?.[0].data;
      return data.map((row: Record<string, unknown>, index: number) => ({
        ...row,
        id: `item-${index + 1}`,
        reviewedAt: null,
      }));
    });

    const result = await submitMealCorrectionBatch({
      userId: "member",
      month: "2026-08",
      changes: [
        { date: "2026-08-05", mealCount: 1 },
        { date: "2026-08-06", mealCount: 3 },
      ],
    });

    expect(result).toMatchObject({
      month: "2026-08",
      status: "pending",
      mealDelta: 1,
    });
    expect(mocks.tx.mealEditRequest.createMany).toHaveBeenCalledOnce();
    expect(mocks.tx.mealRecord.update).not.toHaveBeenCalled();
    expect(mocks.tx.mealRecord.create).not.toHaveBeenCalled();
  });

  it("approves every item and records the decision in one serializable operation", async () => {
    const items = [
      requestItem(),
      requestItem({
        id: "item-2",
        mealRecordId: "record-2",
        targetDate: new Date("2026-08-06T00:00:00.000Z"),
        originalMealCount: 1,
        proposedMealCount: 3,
      }),
    ];
    mocks.tx.mealEditRequest.findFirst.mockResolvedValue(items[0]);
    mocks.tx.mealEditRequest.findMany.mockResolvedValue(items);

    await expect(respondToMealEditReview({
      adminId: "admin",
      reviewId: "batch-1",
      action: "approve",
    })).resolves.toEqual({ status: "approved", changedMeals: 2 });

    expect(mocks.serializable).toHaveBeenCalledOnce();
    expect(mocks.tx.mealRecord.update).toHaveBeenCalledTimes(2);
    expect(mocks.tx.mealEditRequest.updateMany).toHaveBeenCalledWith({
      where: { batchId: "batch-1", status: "pending" },
      data: {
        status: "approved",
        reviewedById: "admin",
        reviewedAt: new Date("2026-09-11T06:00:00.000Z"),
      },
    });
  });

  it("rejects the whole batch without touching meal records", async () => {
    const items = [requestItem(), requestItem({ id: "item-2" })];
    mocks.tx.mealEditRequest.findFirst.mockResolvedValue(items[0]);
    mocks.tx.mealEditRequest.findMany.mockResolvedValue(items);

    await expect(respondToMealEditReview({
      adminId: "admin",
      reviewId: "batch-1",
      action: "reject",
    })).resolves.toEqual({ status: "rejected", changedMeals: 0 });

    expect(mocks.tx.mealRecord.update).not.toHaveBeenCalled();
    expect(mocks.tx.mealRecord.create).not.toHaveBeenCalled();
  });

  it("rejects a stale approval before changing any meal", async () => {
    const item = requestItem();
    mocks.tx.mealEditRequest.findFirst.mockResolvedValue(item);
    mocks.tx.mealEditRequest.findMany.mockResolvedValue([item]);
    mocks.tx.mealRecord.findMany.mockResolvedValue([{
      id: "record-1",
      userId: "member",
      date: new Date("2026-08-05T00:00:00.000Z"),
      mealCount: 4,
      isLocked: true,
    }]);

    await expect(respondToMealEditReview({
      adminId: "admin",
      reviewId: "batch-1",
      action: "approve",
    })).rejects.toMatchObject({ code: "CORRECTION_REQUEST_STALE" });

    expect(mocks.tx.mealRecord.update).not.toHaveBeenCalled();
    expect(mocks.tx.mealEditRequest.updateMany).not.toHaveBeenCalled();
  });

  it("invalidates every pending item when a protected range wins", async () => {
    mocks.tx.mealEditRequest.findMany.mockResolvedValue([
      { batchId: "batch-1" },
      { batchId: "batch-2" },
    ]);
    mocks.tx.mealEditRequest.updateMany.mockResolvedValue({ count: 4 });

    await expect(invalidatePendingMealCorrectionsForRange(
      mocks.tx as never,
      new Date("2026-08-01T00:00:00.000Z"),
      new Date("2026-08-31T00:00:00.000Z")
    )).resolves.toBe(4);

    expect(mocks.tx.mealEditRequest.updateMany).toHaveBeenCalledWith({
      where: { batchId: { in: ["batch-1", "batch-2"] }, status: "pending" },
      data: {
        status: "invalidated",
        reviewedAt: new Date("2026-09-11T06:00:00.000Z"),
      },
    });
  });
});
