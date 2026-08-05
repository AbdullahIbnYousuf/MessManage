import type { TransferSource, TransferStatus } from "@prisma/client";

type TransferParticipants = {
  senderId: string;
  receiverId: string;
  initiatedById: string | null;
};

export function transferInitiatorId(transfer: TransferParticipants): string {
  return transfer.initiatedById === transfer.receiverId
    ? transfer.receiverId
    : transfer.senderId;
}

export function transferConfirmerId(transfer: TransferParticipants): string {
  return transferInitiatorId(transfer) === transfer.senderId
    ? transfer.receiverId
    : transfer.senderId;
}

export function transferInitiation(
  transfer: TransferParticipants
): "sender" | "receiver" {
  return transferInitiatorId(transfer) === transfer.receiverId
    ? "receiver"
    : "sender";
}

export function isBalanceAffectingTransfer(status: TransferStatus): boolean {
  return status === "accepted";
}

export function canRespondToTransfer(status: TransferStatus): boolean {
  return status === "pending";
}

export function canCancelTransfer(status: TransferStatus): boolean {
  return status === "pending";
}

export function canCreateTransferReversal(
  status: TransferStatus,
  source: TransferSource
): boolean {
  return status === "accepted" && source === "direct";
}

export function isTerminalTransferStatus(status: TransferStatus): boolean {
  return status === "accepted" || status === "rejected" || status === "cancelled";
}
