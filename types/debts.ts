import type {
  DebtNotificationEntity,
  DebtNotificationType,
  DebtObligationSource,
  DebtRequestStatus,
  PushDeliveryStatus,
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
  monthlySettlementId: string | null;
  debtRequestId: string | null;
  month: string | null;
  createdAt: Date;
};

export type DebtTransferBalanceRecord = {
  id: string;
  senderId: string;
  receiverId: string;
  initiatedById: string | null;
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

export type DebtPaymentDetail = DebtPaymentLedgerEntry & {
  reversedPaymentIds: string[];
};

export type DebtClearance = DebtMemberTotals & {
  pendingCount: number;
  pendingPaymentCount: number;
  pendingDebtRequestCount: number;
  canDeactivate: boolean;
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
  month: string | null;
  debtRequestId: string | null;
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
  initiatedBy: "sender" | "receiver";
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
  pendingPaymentResponseCount: number;
  pendingPaymentInitiatedCount: number;
  pendingDebtRequestIncomingCount: number;
  pendingDebtRequestOutgoingCount: number;
  unreadNotificationCount: number;
  pairwise: DebtSummaryPairwise[];
  recentActivity: DebtLedgerEntry[];
};

export type DebtRequestItem = {
  id: string;
  amount: string;
  description: string;
  status: DebtRequestStatus;
  rejectionReason: string | null;
  createdAt: string;
  respondedAt: string | null;
  cancelledAt: string | null;
  obligationId: string | null;
  requester: DebtMember;
  debtor: DebtMember;
};

export type DebtRequestPage = {
  requests: DebtRequestItem[];
  nextCursor: string | null;
};

export type DebtRequestFilters = {
  userId: string;
  direction?: "all" | "incoming" | "outgoing";
  status?: DebtRequestStatus;
  cursor?: string;
  limit?: number;
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
  action?: "all" | "needs_response" | "initiated_by_me";
  status?: TransferStatus;
  cursor?: string;
  limit?: number;
};

export type DebtNotificationItem = {
  id: string;
  type: DebtNotificationType;
  entityType: DebtNotificationEntity;
  entityId: string;
  title: string;
  body: string;
  readAt: string | null;
  pushStatus: PushDeliveryStatus;
  pushAttemptedAt: string | null;
  createdAt: string;
};

export type DebtNotificationPage = {
  notifications: DebtNotificationItem[];
  unreadCount: number;
  nextCursor: string | null;
};

export type DebtNotificationDraft = {
  userId: string;
  type: DebtNotificationType;
  entityType: DebtNotificationEntity;
  entityId: string;
  title: string;
  body: string;
};
