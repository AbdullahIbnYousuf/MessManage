import Decimal from "decimal.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const currentUserId = "00000000-0000-4000-8000-000000000001";
const otherUserId = "00000000-0000-4000-8000-000000000002";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  obligationFindMany: vi.fn(),
  transferFindMany: vi.fn(),
  debtRequestFindMany: vi.fn(),
  userFindMany: vi.fn(),
  notificationCount: vi.fn(),
}));

const tx = {
  debtObligation: { findMany: mocks.obligationFindMany },
  transfer: { findMany: mocks.transferFindMany },
  debtRequest: { findMany: mocks.debtRequestFindMany },
  user: { findMany: mocks.userFindMany },
  debtNotification: { count: mocks.notificationCount },
};

vi.mock("@/lib/db", () => ({ db: { $transaction: mocks.transaction } }));

import { fetchDebtSummary } from "@/lib/queries/debts";

function member(id: string, name: string) {
  return { id, name, nickname: null, avatarUrl: null };
}

function transfer({
  id,
  senderId,
  receiverId,
  initiatedById,
  status,
  amount,
  day,
}: {
  id: string;
  senderId: string;
  receiverId: string;
  initiatedById: string | null;
  status: "pending" | "accepted";
  amount: string;
  day: number;
}) {
  return {
    id,
    senderId,
    receiverId,
    initiatedById,
    amount: new Decimal(amount),
    description: null,
    status,
    source: "direct" as const,
    clientRequestId: id,
    reversesTransferId: null,
    rejectionReason: null,
    createdAt: new Date(`2026-08-${String(day).padStart(2, "0")}T00:00:00.000Z`),
    respondedAt: status === "accepted" ? new Date("2026-08-03T00:00:00.000Z") : null,
    cancelledAt: null,
    sender: member(senderId, senderId === currentUserId ? "Current" : "Other"),
    receiver: member(receiverId, receiverId === currentUserId ? "Current" : "Other"),
  };
}

describe("Debt command-center snapshot", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.transaction.mockImplementation(async (callback: (client: typeof tx) => unknown) => callback(tx));
    mocks.obligationFindMany.mockResolvedValue([{
      id: "00000000-0000-4000-8000-000000000010",
      debtorId: currentUserId,
      creditorId: otherUserId,
      amount: new Decimal("100.00"),
      source: "meal_settlement",
      sourceReference: "meal-settlement:one",
      monthlySettlementId: "00000000-0000-4000-8000-000000000011",
      debtRequestId: null,
      createdAt: new Date("2026-08-01T00:00:00.000Z"),
      debtor: member(currentUserId, "Current"),
      creditor: member(otherUserId, "Other"),
      monthlySettlement: { month: new Date("2026-07-01T00:00:00.000Z") },
    }]);
    mocks.transferFindMany.mockResolvedValue([
      transfer({ id: "00000000-0000-4000-8000-000000000020", senderId: currentUserId, receiverId: otherUserId, initiatedById: currentUserId, status: "accepted", amount: "40.00", day: 2 }),
      transfer({ id: "00000000-0000-4000-8000-000000000021", senderId: otherUserId, receiverId: currentUserId, initiatedById: otherUserId, status: "pending", amount: "15.00", day: 3 }),
      transfer({ id: "00000000-0000-4000-8000-000000000022", senderId: currentUserId, receiverId: otherUserId, initiatedById: currentUserId, status: "pending", amount: "10.00", day: 4 }),
    ]);
    mocks.debtRequestFindMany.mockResolvedValue([]);
    mocks.userFindMany.mockResolvedValue([member(otherUserId, "Other")]);
    mocks.notificationCount.mockResolvedValue(2);
  });

  it("returns totals, pending lists, and confirmed activity from one transaction", async () => {
    const result = await fetchDebtSummary(currentUserId);

    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "RepeatableRead",
    });
    expect(result).toMatchObject({
      youOwe: "60.00",
      owedToYou: "0.00",
      net: "-60.00",
      pendingPaymentResponseCount: 1,
      pendingPaymentInitiatedCount: 1,
    });
    expect(result.paymentsNeedingResponse.map((entry) => entry.id)).toEqual([
      "00000000-0000-4000-8000-000000000021",
    ]);
    expect(result.paymentsInitiatedByMe.map((entry) => entry.id)).toEqual([
      "00000000-0000-4000-8000-000000000022",
    ]);
    expect(result.recentActivity.map((entry) => entry.id)).toEqual([
      "00000000-0000-4000-8000-000000000020",
      "00000000-0000-4000-8000-000000000010",
    ]);
    expect(result.pairwise[0]).toMatchObject({ position: "-60.00", direction: "you_owe" });
  });
});
