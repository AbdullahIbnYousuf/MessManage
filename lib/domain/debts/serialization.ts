import type {
  DebtMember,
  DebtObligationBalanceRecord,
  DebtObligationLedgerEntry,
  DebtPaymentLedgerEntry,
  DebtTransferBalanceRecord,
} from "@/types/debts";

export function serializeObligationLedgerEntry(
  obligation: DebtObligationBalanceRecord,
  debtor: DebtMember,
  creditor: DebtMember
): DebtObligationLedgerEntry {
  return {
    type: "obligation",
    id: obligation.id,
    createdAt: obligation.createdAt.toISOString(),
    amount: obligation.amount,
    source: obligation.source,
    sourceReference: obligation.sourceReference,
    month: obligation.month,
    debtRequestId: obligation.debtRequestId,
    debtor,
    creditor,
  };
}

export function serializeTransferLedgerEntry(
  transfer: DebtTransferBalanceRecord,
  sender: DebtMember,
  receiver: DebtMember
): DebtPaymentLedgerEntry {
  return {
    type: "payment",
    id: transfer.id,
    createdAt: transfer.createdAt.toISOString(),
    amount: transfer.amount,
    description: transfer.description,
    status: transfer.status,
    source: transfer.source,
    reversesTransferId: transfer.reversesTransferId,
    rejectionReason: transfer.rejectionReason,
    respondedAt: transfer.respondedAt?.toISOString() ?? null,
    cancelledAt: transfer.cancelledAt?.toISOString() ?? null,
    sender,
    receiver,
  };
}
