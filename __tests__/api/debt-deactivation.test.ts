import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  admin: vi.fn(),
  clearance: vi.fn(),
  serializable: vi.fn(),
  globalUserFind: vi.fn(),
  globalMealFind: vi.fn(),
  txUserFind: vi.fn(),
  txUserUpdate: vi.fn(),
  txMealFind: vi.fn(),
  txMealUpdate: vi.fn(),
}));

const tx = {
  user: { findUnique: mocks.txUserFind, update: mocks.txUserUpdate },
  mealRecord: { findFirst: mocks.txMealFind, updateMany: mocks.txMealUpdate },
};

vi.mock("@/lib/session", () => ({ requireAdmin: mocks.admin }));
vi.mock("@/lib/db", () => ({
  db: {
    user: { findUnique: mocks.globalUserFind },
    mealRecord: { findFirst: mocks.globalMealFind },
  },
}));
vi.mock("@/lib/queries/debt-clearance", () => ({ fetchDebtClearance: mocks.clearance }));
vi.mock("@/lib/services/debts/transactions", () => ({ withSerializableRetry: mocks.serializable }));

import { GET, POST } from "@/app/api/admin/members/[id]/deactivate/route";

const adminId = "00000000-0000-4000-8000-000000000001";
const memberId = "00000000-0000-4000-8000-000000000002";
const joinedAt = new Date("2026-01-01T00:00:00.000Z");

describe("debt-aware member deactivation", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.admin.mockResolvedValue({ id: adminId, role: "admin" });
    mocks.globalUserFind.mockResolvedValue({ status: "active", joinedAt });
    mocks.globalMealFind.mockResolvedValue({ date: new Date("2026-07-20T00:00:00.000Z") });
    mocks.txUserFind.mockResolvedValue({ status: "active", joinedAt });
    mocks.txMealFind.mockResolvedValue({ date: new Date("2026-07-20T00:00:00.000Z") });
    mocks.txUserUpdate.mockResolvedValue({});
    mocks.txMealUpdate.mockResolvedValue({ count: 3 });
    mocks.clearance.mockResolvedValue({ youOwe: "0.00", owedToYou: "0.00", net: "0.00", pendingCount: 0, canDeactivate: true });
    mocks.serializable.mockImplementation((operation: (client: typeof tx) => Promise<unknown>) => operation(tx));
  });

  it("includes debt clearance in the GET preview", async () => {
    mocks.clearance.mockResolvedValue({ youOwe: "10.00", owedToYou: "3.00", net: "-7.00", pendingCount: 1, canDeactivate: false });
    const response = await GET(new Request("http://localhost"), { params: Promise.resolve({ id: memberId }) });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ data: { debtClearance: { youOwe: "10.00", owedToYou: "3.00", pendingCount: 1, canDeactivate: false } } });
  });

  it("returns a stable 409 and performs no writes when debt remains", async () => {
    mocks.clearance.mockResolvedValue({ youOwe: "10.00", owedToYou: "3.00", net: "-7.00", pendingCount: 2, canDeactivate: false });
    const response = await POST(new Request("http://localhost", { method: "POST" }), { params: Promise.resolve({ id: memberId }) });
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ code: "DEACTIVATION_BLOCKED_BY_DEBT", youOwe: "10.00", owedToYou: "3.00", pendingCount: 2 });
    expect(mocks.txUserUpdate).not.toHaveBeenCalled();
    expect(mocks.txMealUpdate).not.toHaveBeenCalled();
  });

  it("rechecks clearance and applies both existing deactivation writes in one serializable callback", async () => {
    const response = await POST(new Request("http://localhost", { method: "POST" }), { params: Promise.resolve({ id: memberId }) });
    expect(response.status).toBe(200);
    expect(mocks.serializable).toHaveBeenCalledOnce();
    expect(mocks.clearance).toHaveBeenCalledWith(tx, memberId);
    expect(mocks.txUserUpdate).toHaveBeenCalledOnce();
    expect(mocks.txMealUpdate).toHaveBeenCalledOnce();
  });
});
