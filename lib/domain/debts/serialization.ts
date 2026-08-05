import type {
  DebtLedgerEntry,
  DebtMember,
  DebtObligationBalanceRecord,
  DebtTransferBalanceRecord,
} from "@/types/debts";

export function serializeObligationLedgerEntry(
  obligation: DebtObligationBalanceRecord,
  debtor: DebtMember,
  creditor: DebtMember
): DebtLedgerEntry {
  return {
    type: "obligation",
    id: obligation.id,
    createdAt: obligation.createdAt.toISOString(),
    amount: obligation.amount,
    source: obligation.source,
    sourceReference: obligation.sourceReference,
    month: obligation.month,
    debtor,
    creditor,
  };
}

export function serializeTransferLedgerEntry(
  transfer: DebtTransferBalanceRecord,
  sender: DebtMember,
  receiver: DebtMember
): DebtLedgerEntry {
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
