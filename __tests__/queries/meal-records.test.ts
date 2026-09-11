import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  serializable: vi.fn(),
  recordFind: vi.fn(),
  recordCreate: vi.fn(),
  patternFind: vi.fn(),
  settlementFind: vi.fn(),
}));

const tx = {
  mealRecord: {
    findMany: mocks.recordFind,
    createMany: mocks.recordCreate,
  },
  mealPattern: { findUnique: mocks.patternFind },
  monthlySettlementRun: { findUnique: mocks.settlementFind },
};

vi.mock("@/lib/services/debts/transactions", () => ({
  withSerializableRetry: mocks.serializable,
}));
vi.mock("@/lib/utils/dates", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/utils/dates")>();
  return {
    ...actual,
    getNow: () => new Date("2026-08-09T06:00:00.000Z"),
    today: () => "2026-08-09",
  };
});

import {
  fetchOrCreateMealRecordsForMonth,
  fetchRollingMealRecords,
} from "@/lib/queries/meal-records";

describe("fetchOrCreateMealRecordsForMonth", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.serializable.mockImplementation(
      (operation: (client: typeof tx) => Promise<unknown>) => operation(tx)
    );
    mocks.patternFind.mockResolvedValue(null);
    mocks.recordCreate.mockResolvedValue({ count: 31 });
  });

  it("does not create missing rows while browsing a historical month", async () => {
    const stored = [{
      id: "existing",
      userId: "member",
      date: new Date("2026-07-01"),
      mealCount: 2,
      isLocked: true,
    }];
    mocks.recordFind.mockResolvedValue(stored);

    const records = await fetchOrCreateMealRecordsForMonth("member", 2026, 7);

    expect(records).toBe(stored);
    expect(mocks.recordCreate).not.toHaveBeenCalled();
    expect(mocks.patternFind).not.toHaveBeenCalled();
    expect(mocks.settlementFind).not.toHaveBeenCalled();
    expect(mocks.recordFind).toHaveBeenCalledOnce();
  });

  it("materializes missing rows inside the same serializable callback for an open month", async () => {
    mocks.recordFind
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: "created" }]);
    mocks.settlementFind.mockResolvedValue(null);

    const records = await fetchOrCreateMealRecordsForMonth("member", 2026, 8);

    expect(mocks.recordCreate).toHaveBeenCalledOnce();
    expect(mocks.recordFind).toHaveBeenCalledTimes(2);
    expect(records).toEqual([{ id: "created" }]);
  });

  it("does not materialize a current month that already has a settlement run", async () => {
    const stored = [{ id: "settled-current" }];
    mocks.recordFind.mockResolvedValue(stored);
    mocks.settlementFind.mockResolvedValue({ id: "run" });

    const records = await fetchOrCreateMealRecordsForMonth("member", 2026, 8);

    expect(records).toBe(stored);
    expect(mocks.recordCreate).not.toHaveBeenCalled();
  });

  it("materializes both current and next month in one rolling transaction", async () => {
    mocks.recordFind.mockResolvedValue([]);
    mocks.settlementFind.mockResolvedValue(null);

    await fetchRollingMealRecords("member", 2026, 8);

    expect(mocks.serializable).toHaveBeenCalledOnce();
    expect(mocks.recordCreate).toHaveBeenCalledTimes(2);
    const currentRows = mocks.recordCreate.mock.calls[0]?.[0].data;
    const nextRows = mocks.recordCreate.mock.calls[1]?.[0].data;
    expect(currentRows).toHaveLength(31);
    expect(nextRows).toHaveLength(30);
    expect(nextRows[0].date).toEqual(new Date("2026-09-01"));
  });
});
