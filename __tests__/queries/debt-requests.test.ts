import Decimal from "decimal.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findMany: vi.fn(), findFirst: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { debtRequest: { findMany: mocks.findMany, findFirst: mocks.findFirst } } }));

import { fetchDebtRequestDetail, fetchDebtRequests } from "@/lib/queries/debt-requests";

const userId = "00000000-0000-4000-8000-000000000001";
const requestId = "00000000-0000-4000-8000-000000000002";

function row() {
  return {
    id: requestId,
    amount: new Decimal("10.00"),
    description: "Shared purchase",
    status: "pending",
    rejectionReason: null,
    createdAt: new Date("2026-08-05T00:00:00.000Z"),
    respondedAt: null,
    cancelledAt: null,
    requester: { id: userId, name: "Requester", nickname: null, avatarUrl: null },
    debtor: { id: "debtor", name: "Debtor", nickname: null, avatarUrl: null },
    obligation: null,
  };
}

describe("debt request participant queries", () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.findMany.mockResolvedValue([row()]); mocks.findFirst.mockResolvedValue(row()); });

  it("always scopes the all-direction history to either participant", async () => {
    await fetchDebtRequests({ userId, direction: "all", limit: 25 });
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { OR: [{ requesterId: userId }, { debtorId: userId }] },
    }));
  });

  it("scopes incoming and outgoing filters to the authenticated role", async () => {
    await fetchDebtRequests({ userId, direction: "incoming", status: "pending", limit: 25 });
    expect(mocks.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: { debtorId: userId, status: "pending" } }));
    await fetchDebtRequests({ userId, direction: "outgoing", limit: 25 });
    expect(mocks.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: { requesterId: userId } }));
  });

  it("requires detail ownership without revealing existence", async () => {
    await fetchDebtRequestDetail(userId, requestId);
    expect(mocks.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: requestId, OR: [{ requesterId: userId }, { debtorId: userId }] },
    }));
  });
});
