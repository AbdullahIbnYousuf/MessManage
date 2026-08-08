import Decimal from "decimal.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const currentUserId = "00000000-0000-4000-8000-000000000001";
const otherUserId = "00000000-0000-4000-8000-000000000002";

const mocks = vi.hoisted(() => ({ transaction: vi.fn(), obligationFindMany: vi.fn(), transferFindMany: vi.fn(), userFindUnique: vi.fn() }));
const tx = {
  debtObligation: { findMany: mocks.obligationFindMany },
  transfer: { findMany: mocks.transferFindMany },
  user: { findUnique: mocks.userFindUnique },
};
vi.mock("@/lib/db", () => ({ db: { $transaction: mocks.transaction } }));

import { fetchDebtMemberStatement } from "@/lib/queries/debts";

function member(id: string, name: string) { return { id, name, nickname: null, avatarUrl: null }; }
function obligation(id: string, debtorId: string, creditorId: string, amount: string) {
  return { id, debtorId, creditorId, amount: new Decimal(amount), source: "meal_settlement" as const, sourceReference: id, monthlySettlementId: id, debtRequestId: null, createdAt: new Date("2026-07-01T00:00:00.000Z"), debtor: member(debtorId, "Debtor"), creditor: member(creditorId, "Creditor"), monthlySettlement: { month: new Date("2026-06-01T00:00:00.000Z") } };
}
function payment(id: string, senderId: string, receiverId: string, amount: string, status: "accepted" | "pending", initiatedById: string) {
  return { id, senderId, receiverId, initiatedById, amount: new Decimal(amount), description: null, status, source: "direct" as const, clientRequestId: id, reversesTransferId: null, rejectionReason: null, createdAt: new Date("2026-08-01T00:00:00.000Z"), respondedAt: status === "accepted" ? new Date("2026-08-01T01:00:00.000Z") : null, cancelledAt: null, sender: member(senderId, "Sender"), receiver: member(receiverId, "Receiver") };
}

describe("Debt member statement", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.transaction.mockImplementation(async (callback: (client: typeof tx) => unknown) => callback(tx));
    mocks.userFindUnique.mockResolvedValue({ ...member(otherUserId, "Other"), status: "deactivated", bkashNumber: "01700000000", bankName: null, bankAccountNumber: null });
    mocks.obligationFindMany.mockResolvedValue([
      obligation("00000000-0000-4000-8000-000000000010", currentUserId, otherUserId, "100.00"),
      obligation("00000000-0000-4000-8000-000000000011", otherUserId, currentUserId, "20.00"),
    ]);
    mocks.transferFindMany.mockResolvedValue([
      payment("00000000-0000-4000-8000-000000000020", currentUserId, otherUserId, "30.00", "accepted", currentUserId),
      payment("00000000-0000-4000-8000-000000000021", otherUserId, currentUserId, "10.00", "accepted", otherUserId),
      payment("00000000-0000-4000-8000-000000000022", otherUserId, currentUserId, "5.00", "pending", otherUserId),
      payment("00000000-0000-4000-8000-000000000023", currentUserId, otherUserId, "7.00", "pending", currentUserId),
    ]);
  });

  it("reconciles the exact pair position and keeps pending records separate", async () => {
    const result = await fetchDebtMemberStatement({ currentUserId, memberId: otherUserId, limit: 25 });
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "RepeatableRead",
    });
    expect(result).toMatchObject({
      position: "-60.00",
      direction: "you_owe",
      components: {
        obligationsYouOwe: "100.00",
        obligationsOwedToYou: "20.00",
        moneyYouSent: "30.00",
        moneyYouReceived: "10.00",
      },
      member: { status: "deactivated", bkashNumber: "01700000000" },
    });
    expect(result.paymentsNeedingResponse.map((entry) => entry.id)).toEqual(["00000000-0000-4000-8000-000000000022"]);
    expect(result.paymentsInitiatedByMe.map((entry) => entry.id)).toEqual(["00000000-0000-4000-8000-000000000023"]);
    expect(result.history).toHaveLength(6);
    expect(result.nextCursor).toBeNull();
    expect(mocks.obligationFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { OR: [{ debtorId: currentUserId, creditorId: otherUserId }, { debtorId: otherUserId, creditorId: currentUserId }] } }));
  });

  it("rejects a statement against the current member", async () => {
    await expect(fetchDebtMemberStatement({ currentUserId, memberId: currentUserId })).rejects.toMatchObject({ code: "SELF_PAYMENT_NOT_ALLOWED" });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
