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
  return { ...actual, today: () => "2026-08-09" };
});

import { fetchOrCreateMealRecordsForMonth } from "@/lib/queries/meal-records";

describe("fetchOrCreateMealRecordsForMonth", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.serializable.mockImplementation(
      (operation: (client: typeof tx) => Promise<unknown>) => operation(tx)
    );
    mocks.patternFind.mockResolvedValue(null);
    mocks.recordCreate.mockResolvedValue({ count: 31 });
  });

  it("does not create missing rows for a settled month", async () => {
    const stored = [{
      id: "existing",
      userId: "member",
      date: new Date("2026-07-01"),
      mealCount: 2,
      isLocked: true,
    }];
    mocks.recordFind.mockResolvedValue(stored);
    mocks.settlementFind.mockResolvedValue({ id: "run" });

    const records = await fetchOrCreateMealRecordsForMonth("member", 2026, 7);

    expect(records).toBe(stored);
    expect(mocks.recordCreate).not.toHaveBeenCalled();
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
});
