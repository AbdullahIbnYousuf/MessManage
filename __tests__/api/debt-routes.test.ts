import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  createPayment: vi.fn(),
  createReceivedMoney: vi.fn(),
  respond: vi.fn(),
  summary: vi.fn(),
  ledger: vi.fn(),
  notificationInbox: vi.fn(),
}));

vi.mock("@/lib/session", () => ({ getSessionUser: mocks.session }));
vi.mock("@/lib/services/debts/payments", () => ({
  createPayment: mocks.createPayment,
  createReceivedMoney: mocks.createReceivedMoney,
  respondToPayment: mocks.respond,
  cancelPayment: vi.fn(),
  createReturnPayment: vi.fn(),
}));
vi.mock("@/lib/queries/debts", () => ({
  fetchDebtSummary: mocks.summary,
  fetchDebtLedger: mocks.ledger,
  fetchDebtObligations: vi.fn(),
  fetchDebtPayments: vi.fn(),
}));
vi.mock("@/lib/queries/debt-notifications", () => ({
  fetchDebtNotificationInbox: mocks.notificationInbox,
}));

import { GET as getSummary } from "@/app/api/debts/summary/route";
import { GET as getLedger } from "@/app/api/debts/ledger/route";
import {
  POST as createPaymentRoute,
} from "@/app/api/debts/payments/route";
import { POST as createReceivedMoneyRoute } from "@/app/api/debts/payments/received/route";
import { POST as respondRoute } from "@/app/api/debts/payments/[id]/respond/route";
import { GET as getNotificationInbox } from "@/app/api/notifications/inbox/route";

const userId = "00000000-0000-4000-8000-000000000001";
const receiverId = "00000000-0000-4000-8000-000000000002";
const paymentId = "00000000-0000-4000-8000-000000000003";
const requestId = "00000000-0000-4000-8000-000000000004";

const activeUser = {
  id: userId,
  email: "member@example.com",
  name: "Member",
  nickname: null,
  avatarUrl: null,
  role: "member",
  status: "active",
};

const payment = {
  type: "payment",
  id: paymentId,
  createdAt: "2026-08-01T00:00:00.000Z",
  amount: "50.00",
  description: null,
  status: "pending",
  source: "direct",
  reversesTransferId: null,
  rejectionReason: null,
  respondedAt: null,
  cancelledAt: null,
  initiatedBy: "sender",
  sender: { id: userId, name: "Member", avatarUrl: null },
  receiver: { id: receiverId, name: "Receiver", avatarUrl: null },
};

describe("DebtSync API routes", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.session.mockResolvedValue(activeUser);
    mocks.createPayment.mockResolvedValue({
      payment,
      created: true,
      notificationIds: ["notification"],
    });
    mocks.createReceivedMoney.mockResolvedValue({
      payment: {
        ...payment,
        initiatedBy: "receiver",
        sender: payment.receiver,
        receiver: payment.sender,
      },
      created: true,
      notificationIds: ["notification"],
    });
    mocks.respond.mockResolvedValue({
      payment: { ...payment, status: "accepted" },
      created: false,
      notificationIds: ["notification"],
    });
    mocks.summary.mockResolvedValue({
      youOwe: "0.00",
      owedToYou: "0.00",
      net: "0.00",
      pendingIncomingCount: 0,
      pendingOutgoingCount: 0,
      pendingPaymentResponseCount: 0,
      pendingPaymentInitiatedCount: 0,
      pendingDebtRequestIncomingCount: 0,
      pendingDebtRequestOutgoingCount: 0,
      unreadNotificationCount: 0,
      pairwise: [],
      recentActivity: [],
    });
    mocks.ledger.mockResolvedValue({ entries: [], nextCursor: null });
    mocks.notificationInbox.mockResolvedValue({
      notifications: [],
      unreadCount: 0,
      nextCursor: null,
    });
    process.env.DEBTSYNC_MUTATIONS_ENABLED = "true";
  });

  afterEach(() => {
    delete process.env.DEBTSYNC_MUTATIONS_ENABLED;
  });

  it("returns stable authentication errors for unauthenticated reads", async () => {
    mocks.session.mockResolvedValue(null);
    const response = await getSummary();
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      code: "AUTH_REQUIRED",
    });
  });

  it("keeps read APIs available while mutations are disabled", async () => {
    process.env.DEBTSYNC_MUTATIONS_ENABLED = "false";
    const summaryResponse = await getSummary();
    expect(summaryResponse.status).toBe(200);

    const response = await createPaymentRoute(new Request("http://localhost/api/debts/payments", {
      method: "POST",
      body: JSON.stringify({
        receiverUserId: receiverId,
        amount: "50.00",
        clientRequestId: requestId,
      }),
    }));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ code: "FEATURE_DISABLED" });
    expect(mocks.createPayment).not.toHaveBeenCalled();
  });

  it("uses only the authenticated actor and returns 201 for a new payment", async () => {
    const response = await createPaymentRoute(new Request("http://localhost/api/debts/payments", {
      method: "POST",
      body: JSON.stringify({
        senderId: "browser-supplied-actor",
        receiverUserId: receiverId,
        amount: "50.00",
        clientRequestId: requestId,
      }),
    }));
    expect(response.status).toBe(201);
    expect(mocks.createPayment).toHaveBeenCalledWith(userId, {
      receiverUserId: receiverId,
      amount: "50.00",
      description: undefined,
      clientRequestId: requestId,
    });
  });

  it("uses the authenticated member as receiver for money received", async () => {
    const response = await createReceivedMoneyRoute(new Request(
      "http://localhost/api/debts/payments/received",
      {
        method: "POST",
        body: JSON.stringify({
          receiverId: "browser-supplied-actor",
          senderUserId: receiverId,
          amount: "50.00",
          clientRequestId: requestId,
        }),
      }
    ));
    expect(response.status).toBe(201);
    expect(mocks.createReceivedMoney).toHaveBeenCalledWith(userId, {
      senderUserId: receiverId,
      amount: "50.00",
      description: undefined,
      clientRequestId: requestId,
    });
  });

  it("passes response ownership only through the authenticated session", async () => {
    const response = await respondRoute(
      new Request(`http://localhost/api/debts/payments/${paymentId}/respond`, {
        method: "POST",
        body: JSON.stringify({ decision: "accept", actorId: "browser-actor" }),
      }),
      { params: Promise.resolve({ id: paymentId }) }
    );
    expect(response.status).toBe(200);
    expect(mocks.respond).toHaveBeenCalledWith(userId, {
      paymentId,
      decision: "accept",
      reason: undefined,
    });
  });

  it("rejects invalid query limits with VALIDATION_ERROR", async () => {
    const response = await getLedger(
      new Request("http://localhost/api/debts/ledger?limit=500")
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(mocks.ledger).not.toHaveBeenCalled();
  });

  it("scopes notification inbox queries to the authenticated user", async () => {
    const response = await getNotificationInbox(
      new Request("http://localhost/api/notifications/inbox?unreadOnly=true")
    );
    expect(response.status).toBe(200);
    expect(mocks.notificationInbox).toHaveBeenCalledWith({
      userId,
      unreadOnly: true,
      cursor: undefined,
      limit: 25,
    });
  });
});
