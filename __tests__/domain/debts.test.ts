import { describe, expect, it } from "vitest";
import {
  calculateHouseholdNet,
  calculateMemberTotals,
  calculatePairwisePositions,
  canCancelTransfer,
  canCreateTransferReversal,
  canRespondToTransfer,
  decodeLedgerCursor,
  paginateLedgerEntries,
  paginateDebtRequests,
  parsePositiveAmount,
  positionForMember,
  transferConfirmerId,
  transferInitiation,
  transferInitiatorId,
  validateOptionalDescription,
  validateRequiredDescription,
  validateRejectionReason,
  validateUuid,
} from "@/lib/domain/debts";
import type {
  DebtLedgerEntry,
  DebtObligationBalanceRecord,
  DebtTransferBalanceRecord,
} from "@/types/debts";

function obligation(
  id: string,
  debtorId: string,
  creditorId: string,
  amount: string,
  month = "2026-05"
): DebtObligationBalanceRecord {
  return {
    id,
    debtorId,
    creditorId,
    amount,
    source: "meal_settlement",
    sourceReference: `meal-settlement:${id}`,
    monthlySettlementId: `settlement-${id}`,
    debtRequestId: null,
    month,
    createdAt: new Date(`${month}-20T00:00:00.000Z`),
  };
}

function transfer(
  id: string,
  senderId: string,
  receiverId: string,
  amount: string,
  status: DebtTransferBalanceRecord["status"] = "accepted",
  source: DebtTransferBalanceRecord["source"] = "direct"
): DebtTransferBalanceRecord {
  return {
    id,
    senderId,
    receiverId,
    initiatedById: null,
    amount,
    description: null,
    status,
    source,
    reversesTransferId: source === "reversal" ? "original-transfer" : null,
    rejectionReason: status === "rejected" ? "Not received" : null,
    createdAt: new Date("2026-06-01T00:00:00.000Z"),
    respondedAt: status === "accepted" || status === "rejected"
      ? new Date("2026-06-02T00:00:00.000Z")
      : null,
    cancelledAt: status === "cancelled"
      ? new Date("2026-06-02T00:00:00.000Z")
      : null,
  };
}

function memberPosition(
  memberId: string,
  otherMemberId: string,
  obligations: DebtObligationBalanceRecord[],
  transfers: DebtTransferBalanceRecord[] = []
): string {
  const position = calculatePairwisePositions(obligations, transfers).find(
    (item) =>
      (item.memberAId === memberId && item.memberBId === otherMemberId)
      || (item.memberAId === otherMemberId && item.memberBId === memberId)
  );
  return position ? positionForMember(position, memberId).toFixed(2) : "0.00";
}

describe("DebtSync accounting", () => {
  it("handles one obligation in each direction", () => {
    expect(memberPosition("a", "b", [obligation("one", "a", "b", "80.00")]))
      .toBe("-80.00");
    expect(memberPosition("a", "b", [obligation("two", "b", "a", "35.00")]))
      .toBe("35.00");
  });

  it("nets opposing obligations across months", () => {
    const obligations = [
      obligation("may", "a", "b", "100.00", "2026-05"),
      obligation("june", "b", "a", "30.00", "2026-06"),
    ];
    expect(memberPosition("a", "b", obligations)).toBe("-70.00");
  });

  it("applies partial, full, and excess accepted payments exactly", () => {
    const obligations = [obligation("debt", "a", "b", "100.00")];
    expect(memberPosition("a", "b", obligations, [transfer("p1", "a", "b", "40.00")]))
      .toBe("-60.00");
    expect(memberPosition("a", "b", obligations, [transfer("p2", "a", "b", "100.00")]))
      .toBe("0.00");
    expect(memberPosition("a", "b", obligations, [transfer("p3", "a", "b", "125.00")]))
      .toBe("25.00");
  });

  it("makes a borrower owe the lender after accepted money received", () => {
    const received = transfer("borrowed", "lender", "borrower", "75.25");
    received.initiatedById = "borrower";
    expect(memberPosition("borrower", "lender", [], [received]))
      .toBe("-75.25");
  });

  it("adds multiple accepted payments and an accepted reversal", () => {
    const obligations = [obligation("debt", "a", "b", "100.00")];
    const transfers = [
      transfer("first", "a", "b", "25.00"),
      transfer("second", "a", "b", "15.00"),
      transfer("return", "b", "a", "10.00", "accepted", "reversal"),
    ];
    expect(memberPosition("a", "b", obligations, transfers)).toBe("-70.00");
  });

  it("excludes pending, rejected, and cancelled payments", () => {
    const obligations = [obligation("debt", "a", "b", "100.00")];
    const transfers = [
      transfer("pending", "a", "b", "80.00", "pending"),
      transfer("rejected", "a", "b", "80.00", "rejected"),
      transfer("cancelled", "a", "b", "80.00", "cancelled"),
    ];
    expect(memberPosition("a", "b", obligations, transfers)).toBe("-100.00");
  });

  it("preserves decimal precision and pairwise antisymmetry", () => {
    const positions = calculatePairwisePositions(
      [obligation("precise", "a", "b", "100.10")],
      [transfer("precise-payment", "a", "b", "33.37")]
    );
    const position = positions[0]!;
    expect(positionForMember(position, "a").toFixed(2)).toBe("-66.73");
    expect(positionForMember(position, "b").toFixed(2)).toBe("66.73");
  });

  it("keeps the household net at zero and separates gross totals", () => {
    const positions = calculatePairwisePositions([
      obligation("ab", "a", "b", "50.00"),
      obligation("ca", "c", "a", "20.00"),
    ], []);
    expect(calculateHouseholdNet(["a", "b", "c"], positions).toFixed(2))
      .toBe("0.00");
    expect(calculateMemberTotals("a", positions)).toEqual({
      youOwe: "50.00",
      owedToYou: "20.00",
      net: "-30.00",
    });
  });
});

const paymentId = "00000000-0000-4000-8000-000000000002";
const obligationId = "00000000-0000-4000-8000-000000000001";

function ledgerEntry(
  type: DebtLedgerEntry["type"],
  id: string,
  createdAt: string
): DebtLedgerEntry {
  const member = { id: "member", name: "Member", avatarUrl: null };
  if (type === "obligation") {
    return {
      type,
      id,
      createdAt,
      amount: "10.00",
      source: "meal_settlement",
      sourceReference: `meal-settlement:${id}`,
      month: "2026-05",
      debtRequestId: null,
      debtor: member,
      creditor: { ...member, id: "other" },
    };
  }
  return {
    type,
    id,
    createdAt,
    amount: "10.00",
    description: null,
    status: "accepted",
    source: "direct",
    reversesTransferId: null,
    rejectionReason: null,
    respondedAt: createdAt,
    cancelledAt: null,
    initiatedBy: "sender",
    sender: member,
    receiver: { ...member, id: "other" },
  };
}

describe("DebtSync ledger and validation", () => {
  it("orders by date, then entry type, then ID and paginates deterministically", () => {
    const entries = [
      ledgerEntry("obligation", obligationId, "2026-06-01T00:00:00.000Z"),
      ledgerEntry("payment", paymentId, "2026-06-01T00:00:00.000Z"),
      ledgerEntry(
        "payment",
        "00000000-0000-4000-8000-000000000003",
        "2026-05-31T00:00:00.000Z"
      ),
    ];
    const firstPage = paginateLedgerEntries(entries, 2);
    expect(firstPage.entries.map((entry) => entry.id)).toEqual([
      paymentId,
      obligationId,
    ]);
    expect(firstPage.nextCursor).not.toBeNull();

    const secondPage = paginateLedgerEntries(entries, 2, firstPage.nextCursor!);
    expect(secondPage.entries).toHaveLength(1);
    expect(secondPage.nextCursor).toBeNull();
  });

  it("rejects malformed cursors instead of restarting pagination", () => {
    expect(() => decodeLedgerCursor("not-a-cursor")).toThrowError(
      "The ledger cursor is invalid."
    );
  });

  it("accepts only positive string amounts with at most two decimals", () => {
    expect(parsePositiveAmount("10.25").toFixed(2)).toBe("10.25");
    expect(() => parsePositiveAmount(10)).toThrow();
    expect(() => parsePositiveAmount("0.00")).toThrow();
    expect(() => parsePositiveAmount("1.001")).toThrow();
  });

  it("trims descriptions and enforces the maximum length", () => {
    expect(validateOptionalDescription("  Paid in cash  ")).toBe("Paid in cash");
    expect(validateOptionalDescription("   ")).toBeNull();
    expect(() => validateOptionalDescription("x".repeat(301))).toThrow();
  });

  it("requires a meaningful debt request description", () => {
    expect(validateRequiredDescription("  Shared medicine  ")).toBe("Shared medicine");
    expect(() => validateRequiredDescription("no")).toThrow();
    expect(() => validateRequiredDescription("x".repeat(301))).toThrow();
  });

  it("paginates participant debt requests deterministically", () => {
    const participant = { id: "member", name: "Member", avatarUrl: null };
    const makeRequest = (id: string, createdAt: string) => ({
      id,
      amount: "10.00",
      description: "Shared purchase",
      status: "pending" as const,
      rejectionReason: null,
      createdAt,
      respondedAt: null,
      cancelledAt: null,
      obligationId: null,
      requester: participant,
      debtor: { ...participant, id: "other" },
    });
    const firstId = "00000000-0000-4000-8000-000000000010";
    const secondId = "00000000-0000-4000-8000-000000000011";
    const requests = [
      makeRequest(firstId, "2026-08-05T00:00:00.000Z"),
      makeRequest(secondId, "2026-08-06T00:00:00.000Z"),
    ];
    const page = paginateDebtRequests(requests, 1);
    expect(page.requests[0]?.id).toBe(secondId);
    expect(page.nextCursor).not.toBeNull();
    expect(paginateDebtRequests(requests, 1, page.nextCursor!).requests[0]?.id).toBe(firstId);
    expect(() => paginateDebtRequests(requests, 1, "bad-cursor")).toThrow();
  });

  it("validates UUIDs and rejection reasons without coercion", () => {
    const uuid = "00000000-0000-4000-8000-000000000001";
    expect(validateUuid(uuid, "clientRequestId")).toBe(uuid);
    expect(() => validateUuid("not-a-uuid", "clientRequestId")).toThrow();
    expect(validateRejectionReason("  Payment not received  ")).toBe(
      "Payment not received"
    );
    expect(() => validateRejectionReason("no")).toThrow();
  });

  it("enforces transfer state-transition predicates", () => {
    expect(canRespondToTransfer("pending")).toBe(true);
    expect(canRespondToTransfer("accepted")).toBe(false);
    expect(canCancelTransfer("pending")).toBe(true);
    expect(canCancelTransfer("rejected")).toBe(false);
    expect(canCreateTransferReversal("accepted", "direct")).toBe(true);
    expect(canCreateTransferReversal("accepted", "reversal")).toBe(false);
    expect(canCreateTransferReversal("pending", "direct")).toBe(false);
  });

  it("derives transfer ownership while preserving legacy records", () => {
    const legacy = { senderId: "sender", receiverId: "receiver", initiatedById: null };
    expect(transferInitiation(legacy)).toBe("sender");
    expect(transferInitiatorId(legacy)).toBe("sender");
    expect(transferConfirmerId(legacy)).toBe("receiver");

    const received = { ...legacy, initiatedById: "receiver" };
    expect(transferInitiation(received)).toBe("receiver");
    expect(transferInitiatorId(received)).toBe("receiver");
    expect(transferConfirmerId(received)).toBe("sender");
  });
});
