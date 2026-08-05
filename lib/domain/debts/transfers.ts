import type { TransferSource, TransferStatus } from "@prisma/client";

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
