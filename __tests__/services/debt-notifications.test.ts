import Decimal from "decimal.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  notificationFindMany: vi.fn(),
  notificationFindFirst: vi.fn(),
  notificationUpdate: vi.fn(),
  notificationUpdateMany: vi.fn(),
  subscriptionUpdate: vi.fn(),
  hasConfig: vi.fn(),
  sendPush: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    debtNotification: {
      findMany: mocks.notificationFindMany,
      findFirst: mocks.notificationFindFirst,
      update: mocks.notificationUpdate,
      updateMany: mocks.notificationUpdateMany,
    },
    pushSubscription: { update: mocks.subscriptionUpdate },
  },
}));

vi.mock("@/lib/utils/push", () => ({
  hasWebPushConfig: mocks.hasConfig,
  sendPushNotification: mocks.sendPush,
}));

import {
  buildObligationNotifications,
  buildPaymentCancelledNotification,
  buildPaymentCreatedNotification,
  buildPaymentResponseNotification,
  paginateNotifications,
} from "@/lib/domain/debts/notifications";
import {
  deliverDebtNotifications,
  persistDebtNotifications,
} from "@/lib/services/debts/notifications";
import {
  markAllDebtNotificationsRead,
  markDebtNotificationRead,
} from "@/lib/services/debts/notification-inbox";

const senderId = "00000000-0000-4000-8000-000000000001";
const receiverId = "00000000-0000-4000-8000-000000000002";
const transferId = "00000000-0000-4000-8000-000000000003";
const notificationId = "00000000-0000-4000-8000-000000000004";

const paymentInput = {
  transferId,
  senderId,
  senderName: "Sender",
  receiverId,
  receiverName: "Receiver",
  amount: "50.00",
  source: "direct" as const,
  initiatedBy: "sender" as const,
};

describe("DebtSync notification copy", () => {
  it("builds obligation notifications for both financial parties", () => {
    const drafts = buildObligationNotifications(
      "obligation-id",
      {
        fromUserId: senderId,
        fromUserName: "Sender",
        toUserId: receiverId,
        toUserName: "Receiver",
        amount: new Decimal("50.00"),
      },
      "2026-07-01"
    );
    expect(drafts.map((draft) => draft.userId)).toEqual([senderId, receiverId]);
    expect(drafts.every((draft) => draft.type === "obligation_created")).toBe(true);
  });

  it("uses the correct direct and reversal event types", () => {
    expect(buildPaymentCreatedNotification(paymentInput).type).toBe("payment_received");
    expect(buildPaymentResponseNotification(paymentInput, "accept").type)
      .toBe("payment_accepted");
    expect(buildPaymentResponseNotification(paymentInput, "reject").type)
      .toBe("payment_rejected");
    expect(buildPaymentCancelledNotification(paymentInput).type)
      .toBe("payment_cancelled");

    const reversal = { ...paymentInput, source: "reversal" as const };
    expect(buildPaymentCreatedNotification(reversal).type).toBe("reversal_received");
    expect(buildPaymentResponseNotification(reversal, "accept").type)
      .toBe("reversal_accepted");
    expect(buildPaymentCancelledNotification(reversal).type)
      .toBe("reversal_cancelled");
  });

  it("targets the lender with contextual receiver-initiated copy", () => {
    const received = { ...paymentInput, initiatedBy: "receiver" as const };
    expect(buildPaymentCreatedNotification(received)).toMatchObject({
      userId: senderId,
      title: "Money sent confirmation requested",
    });
    expect(buildPaymentResponseNotification(received, "accept")).toMatchObject({
      userId: receiverId,
      title: "Received money record accepted",
    });
    expect(buildPaymentCancelledNotification(received)).toMatchObject({
      userId: senderId,
      title: "Received money record cancelled",
    });
  });

  it("rejects malformed notification cursors", () => {
    expect(() => paginateNotifications([], 0, 25, "invalid"))
      .toThrow("The notification cursor is invalid.");
  });
});

describe("DebtSync notification persistence and push", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.notificationUpdateMany.mockResolvedValue({ count: 1 });
    mocks.notificationUpdate.mockResolvedValue({});
    mocks.subscriptionUpdate.mockResolvedValue({});
  });

  it("persists drafts through the caller's financial transaction", async () => {
    const create = vi.fn()
      .mockResolvedValueOnce({ id: "first" })
      .mockResolvedValueOnce({ id: "second" });
    const transactionClient = {
      debtNotification: { create },
    };
    const drafts = buildObligationNotifications(
      "obligation-id",
      {
        fromUserId: senderId,
        fromUserName: "Sender",
        toUserId: receiverId,
        toUserName: "Receiver",
        amount: new Decimal("50.00"),
      },
      "2026-07-01"
    );

    const ids = await persistDebtNotifications(
      transactionClient as never,
      drafts
    );
    expect(ids).toEqual(["first", "second"]);
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("marks push skipped when VAPID is not configured", async () => {
    mocks.hasConfig.mockReturnValue(false);
    mocks.notificationFindMany.mockResolvedValue([]);

    await deliverDebtNotifications([notificationId]);
    expect(mocks.notificationUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ pushStatus: "skipped" }),
    }));
    expect(mocks.sendPush).not.toHaveBeenCalled();
  });

  it("deactivates invalid subscriptions and records failed delivery", async () => {
    mocks.hasConfig.mockReturnValue(true);
    mocks.notificationFindMany.mockResolvedValue([{
      id: notificationId,
      type: "payment_received",
      entityType: "transfer",
      entityId: transferId,
      title: "Payment confirmation requested",
      body: "Recorded payment",
      user: {
        pushSubscriptions: [{
          id: "subscription",
          endpoint: "https://push.example",
          p256dh: "key",
          auth: "auth",
        }],
      },
    }]);
    mocks.sendPush.mockResolvedValue({ invalidSubscription: true });

    await deliverDebtNotifications([notificationId]);
    expect(mocks.subscriptionUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ isActive: false }),
    }));
    expect(mocks.notificationUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ pushStatus: "failed" }),
    }));
  });
});

describe("DebtSync notification ownership", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.notificationUpdateMany.mockResolvedValue({ count: 1 });
  });

  it("scopes mark-one reads to the authenticated owner", async () => {
    mocks.notificationFindFirst.mockResolvedValue({ id: notificationId, readAt: null });
    await markDebtNotificationRead(senderId, notificationId);
    expect(mocks.notificationFindFirst).toHaveBeenCalledWith({
      where: { id: notificationId, userId: senderId },
      select: { id: true, readAt: true },
    });
    expect(mocks.notificationUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: notificationId, userId: senderId, readAt: null },
    }));
  });

  it("does not update a notification that is not owned by the actor", async () => {
    mocks.notificationFindFirst.mockResolvedValue(null);
    await expect(markDebtNotificationRead(senderId, notificationId))
      .rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(mocks.notificationUpdateMany).not.toHaveBeenCalled();
  });

  it("scopes mark-all to the authenticated owner", async () => {
    mocks.notificationUpdateMany.mockResolvedValue({ count: 3 });
    const result = await markAllDebtNotificationsRead(senderId);
    expect(result.updatedCount).toBe(3);
    expect(mocks.notificationUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: senderId, readAt: null },
    }));
  });
});
