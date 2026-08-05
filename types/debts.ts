import type {
  DebtObligationSource,
  TransferSource,
  TransferStatus,
} from "@prisma/client";

export type DebtMember = {
  id: string;
  name: string;
  avatarUrl: string | null;
};

export type DebtObligationBalanceRecord = {
  id: string;
  debtorId: string;
  creditorId: string;
  amount: string;
  source: DebtObligationSource;
  sourceReference: string;
  monthlySettlementId: string;
  month: string;
  createdAt: Date;
};

export type DebtTransferBalanceRecord = {
  id: string;
  senderId: string;
  receiverId: string;
  amount: string;
  description: string | null;
  status: TransferStatus;
  source: TransferSource;
  reversesTransferId: string | null;
  rejectionReason: string | null;
  createdAt: Date;
  respondedAt: Date | null;
  cancelledAt: Date | null;
};

export type DebtPairwisePosition = {
  memberAId: string;
  memberBId: string;
  positionForMemberA: string;
};

export type DebtMemberTotals = {
  youOwe: string;
  owedToYou: string;
  net: string;
};

export type DebtSummaryPairwise = {
  memberId: string;
  memberName: string;
  avatarUrl: string | null;
  position: string;
  direction: "you_owe" | "owes_you" | "settled";
};

export type DebtObligationLedgerEntry = {
  type: "obligation";
  id: string;
  createdAt: string;
  amount: string;
  source: DebtObligationSource;
  sourceReference: string;
  month: string;
  debtor: DebtMember;
  creditor: DebtMember;
};

export type DebtPaymentLedgerEntry = {
  type: "payment";
  id: string;
  createdAt: string;
  amount: string;
  description: string | null;
  status: TransferStatus;
  source: TransferSource;
  reversesTransferId: string | null;
  rejectionReason: string | null;
  respondedAt: string | null;
  cancelledAt: string | null;
  sender: DebtMember;
  receiver: DebtMember;
};

export type DebtLedgerEntry =
  | DebtObligationLedgerEntry
  | DebtPaymentLedgerEntry;

export type DebtLedgerCursor = {
  createdAt: string;
  type: DebtLedgerEntry["type"];
  id: string;
};

export type DebtLedgerPage = {
  entries: DebtLedgerEntry[];
  nextCursor: string | null;
};

export type DebtDashboardSummary = DebtMemberTotals & {
  pendingIncomingCount: number;
  pendingOutgoingCount: number;
  unreadNotificationCount: number;
  pairwise: DebtSummaryPairwise[];
  recentActivity: DebtLedgerEntry[];
};

export type DebtLedgerFilters = {
  memberId?: string;
  type?: "all" | "obligation" | "payment";
  status?: TransferStatus;
  from?: Date;
  to?: Date;
  cursor?: string;
  limit?: number;
};

export type DebtObligationFilters = {
  memberId?: string;
  month?: Date;
  cursor?: string;
  limit?: number;
};

export type DebtPaymentFilters = {
  currentUserId?: string;
  memberId?: string;
  direction?: "all" | "incoming" | "outgoing";
  status?: TransferStatus;
  cursor?: string;
  limit?: number;
};
