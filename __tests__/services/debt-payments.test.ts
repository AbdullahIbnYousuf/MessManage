import { Prisma } from "@prisma/client";
import Decimal from "decimal.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const tx = {
    user: { findUnique: vi.fn() },
    transfer: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    debtNotification: { create: vi.fn() },
  };
  return {
    tx,
    transaction: vi.fn(),
    serializable: vi.fn(),
    outsideFindUnique: vi.fn(),
    outsideFindFirst: vi.fn(),
    persist: vi.fn(),
    deliver: vi.fn(),
  };
});

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: mocks.transaction,
    transfer: {
      findUnique: mocks.outsideFindUnique,
      findFirst: mocks.outsideFindFirst,
    },
  },
}));

vi.mock("@/lib/services/debts/transactions", () => ({
  withSerializableRetry: mocks.serializable,
}));

vi.mock("@/lib/services/debts/notifications", () => ({
  persistDebtNotifications: mocks.persist,
  deliverDebtNotifications: mocks.deliver,
}));

import {
  cancelPayment,
  createPayment,
  createReturnPayment,
  respondToPayment,
} from "@/lib/services/debts/payments";

const actorId = "00000000-0000-4000-8000-000000000001";
const receiverId = "00000000-0000-4000-8000-000000000002";
const paymentId = "00000000-0000-4000-8000-000000000003";
const requestId = "00000000-0000-4000-8000-000000000004";

function member(id: string, name: string) {
  return { id, name, nickname: null, avatarUrl: null };
}

function payment(overrides: Record<string, unknown> = {}) {
  return {
    id: paymentId,
    senderId: actorId,
    receiverId,
    amount: new Decimal("50.00"),
    description: "Cash",
    status: "pending",
    source: "direct",
    clientRequestId: requestId,
    reversesTransferId: null,
    rejectionReason: null,
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
    respondedAt: null,
    cancelledAt: null,
    sender: member(actorId, "Sender"),
    receiver: member(receiverId, "Receiver"),
    ...overrides,
  };
}

describe("DebtSync payment commands", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.tx.user.findUnique.mockResolvedValue({ status: "active" });
    mocks.tx.transfer.findUnique.mockResolvedValue(null);
    mocks.tx.transfer.findFirst.mockResolvedValue(null);
    mocks.tx.transfer.create.mockResolvedValue(payment());
    mocks.tx.transfer.updateMany.mockResolvedValue({ count: 1 });
    mocks.tx.transfer.findUniqueOrThrow.mockResolvedValue(payment());
    mocks.persist.mockResolvedValue(["notification-id"]);
    mocks.deliver.mockResolvedValue(undefined);
    mocks.serializable.mockImplementation(
      async (callback: (client: typeof mocks.tx) => Promise<unknown>) =>
        callback(mocks.tx)
    );
    mocks.transaction.mockImplementation(
      async (callback: (client: typeof mocks.tx) => Promise<unknown>) =>
        callback(mocks.tx)
    );
  });

  it("creates a direct pending payment for the authenticated actor", async () => {
    const result = await createPayment(actorId, {
      receiverUserId: receiverId,
      amount: "50.00",
      description: "  Cash  ",
      clientRequestId: requestId,
    });

    expect(result.created).toBe(true);
    expect(mocks.tx.transfer.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        senderId: actorId,
        receiverId,
        amount: new Decimal("50.00"),
        description: "Cash",
        status: "pending",
        source: "direct",
      }),
    }));
    expect(mocks.persist).toHaveBeenCalledTimes(1);
    expect(mocks.deliver).toHaveBeenCalledWith(["notification-id"]);
  });

  it("rejects self-payments and invalid financial input before persistence", async () => {
    await expect(createPayment(actorId, {
      receiverUserId: actorId,
      amount: "50.00",
      clientRequestId: requestId,
    })).rejects.toMatchObject({ code: "SELF_PAYMENT_NOT_ALLOWED" });
    await expect(createPayment(actorId, {
      receiverUserId: receiverId,
      amount: "0.00",
      clientRequestId: requestId,
    })).rejects.toMatchObject({ code: "INVALID_AMOUNT" });
    await expect(createPayment(actorId, {
      receiverUserId: receiverId,
      amount: "50.00",
      description: "x".repeat(301),
      clientRequestId: requestId,
    })).rejects.toMatchObject({ code: "INVALID_DESCRIPTION" });
    expect(mocks.serializable).not.toHaveBeenCalled();
  });

  it("re-reads both users and rejects an inactive receiver", async () => {
    mocks.tx.user.findUnique
      .mockResolvedValueOnce({ status: "active" })
      .mockResolvedValueOnce({ status: "deactivated" });

    await expect(createPayment(actorId, {
      receiverUserId: receiverId,
      amount: "50.00",
      clientRequestId: requestId,
    })).rejects.toMatchObject({ code: "MEMBER_NOT_FOUND" });
    expect(mocks.tx.transfer.create).not.toHaveBeenCalled();
  });

  it("returns the same payment for an exact idempotent retry", async () => {
    mocks.tx.transfer.findUnique.mockResolvedValue(payment());

    const result = await createPayment(actorId, {
      receiverUserId: receiverId,
      amount: "50.00",
      description: "Cash",
      clientRequestId: requestId,
    });

    expect(result.created).toBe(false);
    expect(mocks.tx.transfer.create).not.toHaveBeenCalled();
    expect(mocks.persist).not.toHaveBeenCalled();
  });

  it("rejects a reused request ID with a different payload", async () => {
    mocks.tx.transfer.findUnique.mockResolvedValue(payment());

    await expect(createPayment(actorId, {
      receiverUserId: receiverId,
      amount: "51.00",
      description: "Cash",
      clientRequestId: requestId,
    })).rejects.toMatchObject({ code: "DUPLICATE_REQUEST_CONFLICT" });
  });

  it("returns the concurrent winner for a matching request ID", async () => {
    mocks.serializable.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique request", {
        code: "P2002",
        clientVersion: "6.19.3",
      })
    );
    mocks.outsideFindUnique.mockResolvedValue(payment());

    const result = await createPayment(actorId, {
      receiverUserId: receiverId,
      amount: "50.00",
      description: "Cash",
      clientRequestId: requestId,
    });
    expect(result.created).toBe(false);
    expect(mocks.persist).not.toHaveBeenCalled();
  });

  it("allows only the receiver to accept or reject a pending payment", async () => {
    mocks.tx.transfer.findUnique.mockResolvedValue(payment());
    await expect(respondToPayment(actorId, {
      paymentId,
      decision: "accept",
    })).rejects.toMatchObject({ code: "PAYMENT_FORBIDDEN" });

    mocks.tx.transfer.findUnique.mockResolvedValue(payment());
    mocks.tx.transfer.findUniqueOrThrow.mockResolvedValue(payment({
      status: "accepted",
      respondedAt: new Date("2026-08-02T00:00:00.000Z"),
    }));
    const result = await respondToPayment(receiverId, {
      paymentId,
      decision: "accept",
    });
    expect(result.payment.status).toBe("accepted");
    expect(mocks.tx.transfer.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: paymentId, status: "pending" },
    }));
  });

  it("requires a valid reason when rejecting", async () => {
    await expect(respondToPayment(receiverId, {
      paymentId,
      decision: "reject",
      reason: "no",
    })).rejects.toMatchObject({ code: "REJECTION_REASON_REQUIRED" });
  });

  it("returns the winning status when a concurrent response wins", async () => {
    mocks.tx.transfer.findUnique
      .mockResolvedValueOnce(payment())
      .mockResolvedValueOnce({ status: "accepted" });
    mocks.tx.transfer.updateMany.mockResolvedValue({ count: 0 });

    await expect(respondToPayment(receiverId, {
      paymentId,
      decision: "reject",
      reason: "Not received",
    })).rejects.toMatchObject({
      code: "PAYMENT_NOT_PENDING",
      details: { currentStatus: "accepted" },
    });
    expect(mocks.persist).not.toHaveBeenCalled();
  });

  it("allows only the sender to cancel a pending payment", async () => {
    mocks.tx.transfer.findUnique.mockResolvedValue(payment());
    await expect(cancelPayment(receiverId, paymentId)).rejects.toMatchObject({
      code: "PAYMENT_FORBIDDEN",
    });

    mocks.tx.transfer.findUnique.mockResolvedValue(payment());
    mocks.tx.transfer.findUniqueOrThrow.mockResolvedValue(payment({
      status: "cancelled",
      cancelledAt: new Date("2026-08-02T00:00:00.000Z"),
    }));
    const result = await cancelPayment(actorId, paymentId);
    expect(result.payment.status).toBe("cancelled");
  });

  it("creates an exact opposite pending return payment", async () => {
    const original = payment({ status: "accepted" });
    const reversal = payment({
      id: "00000000-0000-4000-8000-000000000005",
      senderId: receiverId,
      receiverId: actorId,
      sender: member(receiverId, "Receiver"),
      receiver: member(actorId, "Sender"),
      source: "reversal",
      reversesTransferId: paymentId,
      description: null,
      clientRequestId: "00000000-0000-4000-8000-000000000006",
    });
    mocks.tx.transfer.findUnique
      .mockResolvedValueOnce(original)
      .mockResolvedValueOnce(null);
    mocks.tx.transfer.create.mockResolvedValue(reversal);

    const result = await createReturnPayment(receiverId, {
      paymentId,
      clientRequestId: "00000000-0000-4000-8000-000000000006",
    });
    expect(result.created).toBe(true);
    expect(mocks.tx.transfer.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        senderId: receiverId,
        receiverId: actorId,
        amount: original.amount,
        source: "reversal",
        reversesTransferId: paymentId,
      }),
    }));
  });

  it("blocks ineligible and already-active return payments", async () => {
    mocks.tx.transfer.findUnique.mockResolvedValueOnce(payment({ status: "pending" }));
    await expect(createReturnPayment(receiverId, {
      paymentId,
      clientRequestId: "00000000-0000-4000-8000-000000000006",
    })).rejects.toMatchObject({ code: "REVERSAL_NOT_ALLOWED" });

    mocks.tx.transfer.findUnique
      .mockResolvedValueOnce(payment({ status: "accepted" }))
      .mockResolvedValueOnce(null);
    mocks.tx.transfer.findFirst.mockResolvedValue({ id: "active-return" });
    await expect(createReturnPayment(receiverId, {
      paymentId,
      clientRequestId: "00000000-0000-4000-8000-000000000007",
    })).rejects.toMatchObject({ code: "ACTIVE_REVERSAL_EXISTS" });
  });

  it("maps a concurrent active-reversal unique conflict", async () => {
    const uniqueError = new Prisma.PrismaClientKnownRequestError("Unique reversal", {
      code: "P2002",
      clientVersion: "6.19.3",
    });
    mocks.serializable.mockRejectedValue(uniqueError);
    mocks.outsideFindUnique.mockResolvedValue(null);
    mocks.outsideFindFirst.mockResolvedValue({ id: "winner" });

    await expect(createReturnPayment(receiverId, {
      paymentId,
      clientRequestId: "00000000-0000-4000-8000-000000000008",
    })).rejects.toMatchObject({ code: "ACTIVE_REVERSAL_EXISTS" });
  });

  it("does not roll back a committed payment when push delivery fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.deliver.mockRejectedValue(new Error("push failed"));

    const result = await createPayment(actorId, {
      receiverUserId: receiverId,
      amount: "50.00",
      description: "Cash",
      clientRequestId: requestId,
    });
    expect(result.created).toBe(true);
    errorSpy.mockRestore();
  });
});
