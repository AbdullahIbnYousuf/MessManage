import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  admin: vi.fn(),
  serializable: vi.fn(),
  userFind: vi.fn(),
  userUpdate: vi.fn(),
  settlementFind: vi.fn(),
  patternFind: vi.fn(),
  mealUpdate: vi.fn(),
}));

const tx = {
  user: { findUnique: mocks.userFind, update: mocks.userUpdate },
  monthlySettlementRun: { findUnique: mocks.settlementFind },
  mealPattern: { findUnique: mocks.patternFind },
  mealRecord: { updateMany: mocks.mealUpdate },
};

vi.mock("@/lib/session", () => ({ requireAdmin: mocks.admin }));
vi.mock("@/lib/services/debts/transactions", () => ({
  withSerializableRetry: mocks.serializable,
}));
vi.mock("@/lib/utils/dates", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/utils/dates")>();
  return {
    ...actual,
    currentMonthStart: () => new Date("2026-08-01"),
    today: () => "2026-08-09",
  };
});
vi.mock("@/lib/domain/meal", () => ({
  futureDatesInCurrentMonth: () => ["2026-08-09", "2026-08-10"],
  applyPatternToDate: () => 2,
}));

import { POST } from "@/app/api/admin/members/[id]/reactivate/route";

const memberId = "00000000-0000-4000-8000-000000000002";

describe("member reactivation month safety", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.admin.mockResolvedValue({ id: "admin" });
    mocks.userFind.mockResolvedValue({ id: memberId, status: "deactivated" });
    mocks.userUpdate.mockResolvedValue({});
    mocks.settlementFind.mockResolvedValue(null);
    mocks.patternFind.mockResolvedValue({ monday: 2 });
    mocks.mealUpdate.mockResolvedValue({ count: 1 });
    mocks.serializable.mockImplementation(
      (operation: (client: typeof tx) => Promise<unknown>) => operation(tx)
    );
  });

  it("reactivates and restores only tomorrow onward in an open month", async () => {
    const response = await POST(new Request("http://localhost", { method: "POST" }), {
      params: Promise.resolve({ id: memberId }),
    });

    expect(response.status).toBe(200);
    expect(mocks.serializable).toHaveBeenCalledOnce();
    expect(mocks.userUpdate).toHaveBeenCalledOnce();
    expect(mocks.mealUpdate).toHaveBeenCalledOnce();
    expect(mocks.mealUpdate).toHaveBeenCalledWith({
      where: {
        userId: memberId,
        date: new Date("2026-08-10"),
        isLocked: false,
      },
      data: { mealCount: 2 },
    });
  });

  it("reactivates without rewriting meal rows in a settled current month", async () => {
    mocks.settlementFind.mockResolvedValue({ id: "current-run" });

    const response = await POST(new Request("http://localhost", { method: "POST" }), {
      params: Promise.resolve({ id: memberId }),
    });

    expect(response.status).toBe(200);
    expect(mocks.userUpdate).toHaveBeenCalledOnce();
    expect(mocks.patternFind).not.toHaveBeenCalled();
    expect(mocks.mealUpdate).not.toHaveBeenCalled();
  });
});
