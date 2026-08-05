import { Prisma } from "@prisma/client";
import Decimal from "decimal.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const tx = {
    user: { findUnique: vi.fn() },
    debtRequest: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    debtObligation: { create: vi.fn() },
    debtNotification: { create: vi.fn() },
  };
  return {
    tx,
    serializable: vi.fn(),
    outsideFindUnique: vi.fn(),
    persist: vi.fn(),
    deliver: vi.fn(),
  };
});

vi.mock("@/lib/db", () => ({ db: { debtRequest: { findUnique: mocks.outsideFindUnique } } }));
vi.mock("@/lib/services/debts/transactions", () => ({ withSerializableRetry: mocks.serializable }));
vi.mock("@/lib/services/debts/notifications", () => ({
  persistDebtNotifications: mocks.persist,
  deliverDebtNotifications: mocks.deliver,
}));

import {
  cancelDebtRequest,
  createDebtRequest,
  respondToDebtRequest,
} from "@/lib/services/debts/requests";

const requesterId = "00000000-0000-4000-8000-000000000001";
const debtorId = "00000000-0000-4000-8000-000000000002";
const otherId = "00000000-0000-4000-8000-000000000003";
const debtRequestId = "00000000-0000-4000-8000-000000000004";
const clientRequestId = "00000000-0000-4000-8000-000000000005";

function member(id: string, name: string) {
  return { id, name, nickname: null, avatarUrl: null };
}

function debtRequest(overrides: Record<string, unknown> = {}) {
  return {
    id: debtRequestId,
    requesterId,
    debtorId,
    amount: new Decimal("125.50"),
    description: "Shared medicine purchase",
    status: "pending",
    clientRequestId,
    rejectionReason: null,
    createdAt: new Date("2026-08-05T10:00:00.000Z"),
    respondedAt: null,
    cancelledAt: null,
    requester: member(requesterId, "Requester"),
    debtor: member(debtorId, "Debtor"),
    obligation: null,
    ...overrides,
  };
}

describe("DebtSync debt request commands", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.tx.user.findUnique.mockResolvedValue({ status: "active" });
    mocks.tx.debtRequest.findUnique.mockResolvedValue(null);
    mocks.tx.debtRequest.create.mockResolvedValue(debtRequest());
    mocks.tx.debtRequest.updateMany.mockResolvedValue({ count: 1 });
    mocks.tx.debtRequest.findUniqueOrThrow.mockResolvedValue(debtRequest());
    mocks.tx.debtObligation.create.mockResolvedValue({ id: "obligation" });
    mocks.persist.mockResolvedValue(["notification"]);
    mocks.deliver.mockResolvedValue(undefined);
    mocks.serializable.mockImplementation(
      async (callback: (client: typeof mocks.tx) => Promise<unknown>) => callback(mocks.tx)
    );
  });

  it("creates a participant-only pending request with no obligation", async () => {
    const result = await createDebtRequest(requesterId, {
      debtorUserId: debtorId,
      amount: "125.50",
      description: "  Shared medicine purchase  ",
      clientRequestId,
    });
    expect(result.created).toBe(true);
    expect(mocks.tx.debtRequest.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ requesterId, debtorId, amount: new Decimal("125.50"), description: "Shared medicine purchase", status: "pending" }),
    }));
    expect(mocks.tx.debtObligation.create).not.toHaveBeenCalled();
    expect(mocks.persist).toHaveBeenCalledOnce();
  });

  it("rejects self requests, invalid amounts, and short descriptions before persistence", async () => {
    await expect(createDebtRequest(requesterId, { debtorUserId: requesterId, amount: "10.00", description: "Valid reason", clientRequestId })).rejects.toMatchObject({ code: "SELF_DEBT_REQUEST_NOT_ALLOWED" });
    await expect(createDebtRequest(requesterId, { debtorUserId: debtorId, amount: "0.00", description: "Valid reason", clientRequestId })).rejects.toMatchObject({ code: "INVALID_AMOUNT" });
    await expect(createDebtRequest(requesterId, { debtorUserId: debtorId, amount: "10.00", description: "no", clientRequestId })).rejects.toMatchObject({ code: "INVALID_DEBT_REQUEST_DESCRIPTION" });
    expect(mocks.serializable).not.toHaveBeenCalled();
  });

  it("re-reads both member statuses and blocks an inactive debtor", async () => {
    mocks.tx.user.findUnique.mockResolvedValueOnce({ status: "active" }).mockResolvedValueOnce({ status: "deactivated" });
    await expect(createDebtRequest(requesterId, { debtorUserId: debtorId, amount: "125.50", description: "Shared medicine purchase", clientRequestId })).rejects.toMatchObject({ code: "MEMBER_NOT_FOUND" });
    expect(mocks.tx.debtRequest.create).not.toHaveBeenCalled();
  });

  it("returns an exact idempotent retry and rejects a conflicting request ID", async () => {
    mocks.tx.debtRequest.findUnique.mockResolvedValue(debtRequest());
    await expect(createDebtRequest(requesterId, { debtorUserId: debtorId, amount: "125.50", description: "Shared medicine purchase", clientRequestId })).resolves.toMatchObject({ created: false });
    await expect(createDebtRequest(requesterId, { debtorUserId: debtorId, amount: "126.00", description: "Shared medicine purchase", clientRequestId })).rejects.toMatchObject({ code: "DEBT_REQUEST_DUPLICATE_CONFLICT" });
  });

  it("recovers a matching concurrent creation winner", async () => {
    mocks.serializable.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("duplicate", { code: "P2002", clientVersion: "6.19.3" }));
    mocks.outsideFindUnique.mockResolvedValue(debtRequest());
    await expect(createDebtRequest(requesterId, { debtorUserId: debtorId, amount: "125.50", description: "Shared medicine purchase", clientRequestId })).resolves.toMatchObject({ created: false });
  });

  it("lets only the debtor accept and atomically creates one permanent obligation", async () => {
    mocks.tx.debtRequest.findUnique.mockResolvedValue(debtRequest());
    await expect(respondToDebtRequest(otherId, { requestId: debtRequestId, decision: "accept" })).rejects.toMatchObject({ code: "DEBT_REQUEST_FORBIDDEN" });

    mocks.tx.debtRequest.findUnique.mockResolvedValue(debtRequest());
    mocks.tx.debtRequest.findUniqueOrThrow.mockResolvedValue(debtRequest({ status: "accepted", respondedAt: new Date(), obligation: { id: "obligation" } }));
    const result = await respondToDebtRequest(debtorId, { requestId: debtRequestId, decision: "accept" });
    expect(result.request.status).toBe("accepted");
    expect(mocks.tx.debtRequest.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: debtRequestId, status: "pending" } }));
    expect(mocks.tx.debtObligation.create).toHaveBeenCalledWith({ data: expect.objectContaining({ debtorId, creditorId: requesterId, amount: new Decimal("125.50"), source: "member_request", sourceReference: `debt-request:${debtRequestId}`, debtRequestId }) });
    expect(mocks.persist).toHaveBeenCalledOnce();
  });

  it("rejects with a reason and never creates an obligation", async () => {
    mocks.tx.debtRequest.findUnique.mockResolvedValue(debtRequest());
    mocks.tx.debtRequest.findUniqueOrThrow.mockResolvedValue(debtRequest({ status: "rejected", rejectionReason: "I did not agree to this", respondedAt: new Date() }));
    await respondToDebtRequest(debtorId, { requestId: debtRequestId, decision: "reject", reason: "I did not agree to this" });
    expect(mocks.tx.debtObligation.create).not.toHaveBeenCalled();
    expect(mocks.tx.debtRequest.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "rejected", rejectionReason: "I did not agree to this" }) }));
  });

  it("allows only the requester to cancel a pending request", async () => {
    mocks.tx.debtRequest.findUnique.mockResolvedValue(debtRequest());
    await expect(cancelDebtRequest(debtorId, debtRequestId)).rejects.toMatchObject({ code: "DEBT_REQUEST_FORBIDDEN" });
    mocks.tx.debtRequest.findUnique.mockResolvedValue(debtRequest());
    mocks.tx.debtRequest.findUniqueOrThrow.mockResolvedValue(debtRequest({ status: "cancelled", cancelledAt: new Date() }));
    await cancelDebtRequest(requesterId, debtRequestId);
    expect(mocks.tx.debtObligation.create).not.toHaveBeenCalled();
  });

  it("returns 409 details when another terminal transition wins", async () => {
    mocks.tx.debtRequest.findUnique.mockResolvedValueOnce(debtRequest()).mockResolvedValueOnce({ status: "accepted" });
    mocks.tx.debtRequest.updateMany.mockResolvedValue({ count: 0 });
    await expect(respondToDebtRequest(debtorId, { requestId: debtRequestId, decision: "reject", reason: "Not correct" })).rejects.toMatchObject({ code: "DEBT_REQUEST_NOT_PENDING", details: { currentStatus: "accepted" } });
  });

  it("keeps a committed request successful when push delivery fails", async () => {
    mocks.deliver.mockRejectedValue(new Error("push failed"));
    await expect(createDebtRequest(requesterId, { debtorUserId: debtorId, amount: "125.50", description: "Shared medicine purchase", clientRequestId })).resolves.toMatchObject({ created: true });
  });
});
