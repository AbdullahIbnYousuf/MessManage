import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  serializable: vi.fn(),
  assertMonthOpen: vi.fn(),
  configFind: vi.fn(),
  recordFind: vi.fn(),
  recordUpdate: vi.fn(),
  requestFind: vi.fn(),
}));

const tx = {
  systemConfig: { findFirst: mocks.configFind },
  mealRecord: {
    findUnique: mocks.recordFind,
    update: mocks.recordUpdate,
  },
  mealEditRequest: { findFirst: mocks.requestFind },
};

vi.mock("@/lib/session", () => ({ requireAuth: mocks.auth }));
vi.mock("@/lib/services/debts/transactions", () => ({
  withSerializableRetry: mocks.serializable,
}));
vi.mock("@/lib/services/month-state", () => ({
  assertMonthOpen: mocks.assertMonthOpen,
}));
vi.mock("@/lib/utils/dates", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/utils/dates")>();
  return {
    ...actual,
    getNow: () => new Date("2026-08-17T06:00:00.000Z"),
    today: () => "2026-08-17",
  };
});

import { PUT } from "@/app/api/meals/records/[date]/route";

function request(mealCount = 2) {
  return new Request("http://localhost/api/meals/records/date", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mealCount }),
  });
}

describe("individual meal scheduling range", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.auth.mockResolvedValue({ id: "member" });
    mocks.configFind.mockResolvedValue({ mealDeadline: "22:00" });
    mocks.recordFind.mockResolvedValue({
      id: "record",
      date: new Date("2026-09-01"),
      mealCount: 1,
      isLocked: false,
    });
    mocks.recordUpdate.mockResolvedValue({
      id: "record",
      date: new Date("2026-09-01"),
      mealCount: 2,
      isLocked: false,
    });
    mocks.serializable.mockImplementation(
      (operation: (client: typeof tx) => Promise<unknown>) => operation(tx)
    );
  });

  it("allows direct editing in the next month", async () => {
    const response = await PUT(request(), {
      params: Promise.resolve({ date: "2026-09-01" }),
    });

    expect(response.status).toBe(200);
    expect(mocks.assertMonthOpen).toHaveBeenCalledWith(
      tx,
      new Date("2026-09-01")
    );
    expect(mocks.recordUpdate).toHaveBeenCalledOnce();
  });

  it("rejects editing beyond the next month", async () => {
    const response = await PUT(request(), {
      params: Promise.resolve({ date: "2026-10-01" }),
    });

    expect(response.status).toBe(400);
    expect(mocks.serializable).not.toHaveBeenCalled();
  });
});
