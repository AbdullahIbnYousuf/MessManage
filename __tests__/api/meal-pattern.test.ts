import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  serializable: vi.fn(),
  assertMonthOpen: vi.fn(),
  deadlinePassed: vi.fn(),
  configFind: vi.fn(),
  patternUpsert: vi.fn(),
  recordUpdate: vi.fn(),
  ensureRecords: vi.fn(),
}));

const tx = {
  systemConfig: { findFirst: mocks.configFind },
  mealPattern: { upsert: mocks.patternUpsert },
  mealRecord: { updateMany: mocks.recordUpdate },
};

vi.mock("@/lib/session", () => ({ requireAuth: mocks.auth }));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/services/month-state", () => ({ assertMonthOpen: mocks.assertMonthOpen }));
vi.mock("@/lib/services/debts/transactions", () => ({
  withSerializableRetry: mocks.serializable,
}));
vi.mock("@/lib/utils/dates", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/utils/dates")>();
  return {
    ...actual,
    currentMonthKey: () => "2026-08-01",
    getNow: () => new Date("2026-08-09T12:00:00.000Z"),
    isDeadlinePassed: mocks.deadlinePassed,
    today: () => "2026-08-09",
  };
});
vi.mock("@/lib/domain/meal", () => ({
  futureDatesInCurrentMonth: () => ["2026-08-09", "2026-08-10", "2026-08-11"],
  applyPatternToDate: () => 2,
}));
vi.mock("@/lib/queries/meal-records", () => ({
  ensureMealRecordsForMonth: mocks.ensureRecords,
}));

import { PUT } from "@/app/api/meals/pattern/route";

const completePattern = {
  monday: 2,
  tuesday: 2,
  wednesday: 2,
  thursday: 2,
  friday: 2,
  saturday: 2,
  sunday: 2,
};

function request() {
  return new Request("http://localhost/api/meals/pattern", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(completePattern),
  });
}

describe("meal pattern propagation deadline", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.auth.mockResolvedValue({ id: "member" });
    mocks.configFind.mockResolvedValue({ mealDeadline: "22:00" });
    mocks.assertMonthOpen.mockResolvedValue(undefined);
    mocks.patternUpsert.mockResolvedValue({});
    mocks.recordUpdate.mockResolvedValue({ count: 1 });
    mocks.ensureRecords.mockResolvedValue([]);
    mocks.serializable.mockImplementation(
      (operation: (client: typeof tx) => Promise<unknown>) => operation(tx)
    );
  });

  it("propagates from today before the deadline", async () => {
    mocks.deadlinePassed.mockReturnValue(false);

    const response = await PUT(request());

    expect(response.status).toBe(200);
    expect(mocks.assertMonthOpen).toHaveBeenCalledWith(
      tx,
      new Date("2026-08-01")
    );
    expect(mocks.assertMonthOpen).toHaveBeenCalledWith(
      tx,
      new Date("2026-09-01")
    );
    expect(mocks.ensureRecords).toHaveBeenCalledTimes(2);
    expect(mocks.recordUpdate).toHaveBeenCalledTimes(53);
    expect(mocks.recordUpdate).toHaveBeenNthCalledWith(1, {
      where: {
        userId: "member",
        date: new Date("2026-08-09"),
        isLocked: false,
      },
      data: { mealCount: 2 },
    });
  });

  it("leaves today unchanged at or after the deadline", async () => {
    mocks.deadlinePassed.mockReturnValue(true);

    const response = await PUT(request());

    expect(response.status).toBe(200);
    expect(mocks.patternUpsert).toHaveBeenCalledOnce();
    expect(mocks.recordUpdate).toHaveBeenCalledTimes(52);
    expect(mocks.recordUpdate).not.toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ date: new Date("2026-08-09") }),
      })
    );
  });
});
