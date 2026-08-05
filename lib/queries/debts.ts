import { Prisma } from "@prisma/client";
import Decimal from "decimal.js";
import { db } from "@/lib/db";
import {
  calculateMemberTotals,
  calculatePairwisePositions,
  DebtValidationError,
  paginateLedgerEntries,
  positionForMember,
  serializeObligationLedgerEntry,
  serializeTransferLedgerEntry,
} from "@/lib/domain/debts";
import type {
  DebtDashboardSummary,
  DebtLedgerEntry,
  DebtLedgerFilters,
  DebtLedgerPage,
  DebtMember,
  DebtObligationBalanceRecord,
  DebtObligationFilters,
  DebtPaymentDetail,
  DebtPaymentLedgerEntry,
  DebtPaymentFilters,
  DebtTransferBalanceRecord,
} from "@/types/debts";

const memberSelect = {
  id: true,
  name: true,
  nickname: true,
  avatarUrl: true,
} satisfies Prisma.UserSelect;

function displayMember(member: {
  id: string;
  name: string;
  nickname: string | null;
  avatarUrl: string | null;
}): DebtMember {
  return {
    id: member.id,
    name: member.nickname || member.name,
    avatarUrl: member.avatarUrl,
  };
}

type ObligationWithRelations = Prisma.DebtObligationGetPayload<{
  include: {
    debtor: { select: typeof memberSelect };
    creditor: { select: typeof memberSelect };
    monthlySettlement: { select: { month: true } };
  };
}>;

type TransferWithRelations = Prisma.TransferGetPayload<{
  include: {
    sender: { select: typeof memberSelect };
    receiver: { select: typeof memberSelect };
  };
}>;

function obligationBalanceRecord(
  obligation: ObligationWithRelations
): DebtObligationBalanceRecord {
  return {
    id: obligation.id,
    debtorId: obligation.debtorId,
    creditorId: obligation.creditorId,
    amount: obligation.amount.toFixed(2),
    source: obligation.source,
    sourceReference: obligation.sourceReference,
    monthlySettlementId: obligation.monthlySettlementId,
    debtRequestId: obligation.debtRequestId,
    month: obligation.monthlySettlement?.month.toISOString().slice(0, 7) ?? null,
    createdAt: obligation.createdAt,
  };
}

function transferBalanceRecord(
  transfer: TransferWithRelations
): DebtTransferBalanceRecord {
  return {
    id: transfer.id,
    senderId: transfer.senderId,
    receiverId: transfer.receiverId,
    amount: transfer.amount.toFixed(2),
    description: transfer.description,
    status: transfer.status,
    source: transfer.source,
    reversesTransferId: transfer.reversesTransferId,
    rejectionReason: transfer.rejectionReason,
    createdAt: transfer.createdAt,
    respondedAt: transfer.respondedAt,
    cancelledAt: transfer.cancelledAt,
  };
}

function normalizeObligation(
  obligation: ObligationWithRelations
): DebtLedgerEntry {
  return serializeObligationLedgerEntry(
    obligationBalanceRecord(obligation),
    displayMember(obligation.debtor),
    displayMember(obligation.creditor)
  );
}

function normalizeTransfer(transfer: TransferWithRelations): DebtPaymentLedgerEntry {
  return serializeTransferLedgerEntry(
    transferBalanceRecord(transfer),
    displayMember(transfer.sender),
    displayMember(transfer.receiver)
  );
}

export async function fetchDebtPaymentDetail(
  paymentId: string
): Promise<DebtPaymentDetail | null> {
  const [transfer, reversedPayments] = await Promise.all([
    db.transfer.findUnique({
      where: { id: paymentId },
      include: transferInclude,
    }),
    db.transfer.findMany({
      where: { reversesTransferId: paymentId },
      select: { id: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!transfer) return null;
  return {
    ...normalizeTransfer(transfer),
    reversedPaymentIds: reversedPayments.map((payment) => payment.id),
  };
}

function normalizeLimit(limit: number | undefined): number {
  return limit ?? 25;
}

function obligationMemberWhere(memberId: string): Prisma.DebtObligationWhereInput {
  return {
    OR: [{ debtorId: memberId }, { creditorId: memberId }],
  };
}

function transferMemberWhere(memberId: string): Prisma.TransferWhereInput {
  return {
    OR: [{ senderId: memberId }, { receiverId: memberId }],
  };
}

const obligationInclude = {
  debtor: { select: memberSelect },
  creditor: { select: memberSelect },
  monthlySettlement: { select: { month: true } },
} satisfies Prisma.DebtObligationInclude;

const transferInclude = {
  sender: { select: memberSelect },
  receiver: { select: memberSelect },
} satisfies Prisma.TransferInclude;

export async function fetchDebtSummary(
  currentUserId: string
): Promise<DebtDashboardSummary> {
  const involvement = transferMemberWhere(currentUserId);
  const [obligations, transfers, pendingDebtRequests, members, unreadNotificationCount] = await Promise.all([
    db.debtObligation.findMany({
      where: obligationMemberWhere(currentUserId),
      include: obligationInclude,
    }),
    db.transfer.findMany({
      where: involvement,
      include: transferInclude,
    }),
    db.debtRequest.findMany({
      where: {
        status: "pending",
        OR: [{ requesterId: currentUserId }, { debtorId: currentUserId }],
      },
      select: { requesterId: true, debtorId: true },
    }),
    db.user.findMany({
      where: { id: { not: currentUserId } },
      select: memberSelect,
    }),
    db.debtNotification.count({
      where: { userId: currentUserId, readAt: null },
    }),
  ]);

  const obligationRecords = obligations.map(obligationBalanceRecord);
  const transferRecords = transfers.map(transferBalanceRecord);
  const positions = calculatePairwisePositions(obligationRecords, transferRecords);
  const totals = calculateMemberTotals(currentUserId, positions);
  const pendingIncoming = transfers.filter(
    (transfer) => transfer.receiverId === currentUserId && transfer.status === "pending"
  );
  const pendingOutgoing = transfers.filter(
    (transfer) => transfer.senderId === currentUserId && transfer.status === "pending"
  );
  const pendingDebtRequestIncomingCount = pendingDebtRequests.filter(
    (request) => request.debtorId === currentUserId
  ).length;
  const pendingDebtRequestOutgoingCount = pendingDebtRequests.filter(
    (request) => request.requesterId === currentUserId
  ).length;
  const pendingMemberIds = new Set(
    [
      ...[...pendingIncoming, ...pendingOutgoing].map((transfer) =>
        transfer.senderId === currentUserId ? transfer.receiverId : transfer.senderId
      ),
      ...pendingDebtRequests.map((request) =>
        request.requesterId === currentUserId ? request.debtorId : request.requesterId
      ),
    ]
  );

  const pairwise = members
    .map((member) => {
      const pair = positions.find((position) =>
        (position.memberAId === currentUserId && position.memberBId === member.id)
        || (position.memberAId === member.id && position.memberBId === currentUserId)
      );
      const value = pair ? positionForMember(pair, currentUserId) : new Decimal(0);
      return {
        memberId: member.id,
        memberName: member.nickname || member.name,
        avatarUrl: member.avatarUrl,
        position: value.toFixed(2),
        direction: value.lt(0)
          ? "you_owe" as const
          : value.gt(0)
            ? "owes_you" as const
            : "settled" as const,
        hasPending: pendingMemberIds.has(member.id),
      };
    })
    .filter((position) => position.position !== "0.00" || position.hasPending)
    .sort((left, right) =>
      new Decimal(right.position).abs().cmp(new Decimal(left.position).abs())
    )
    .map((position) => ({
      memberId: position.memberId,
      memberName: position.memberName,
      avatarUrl: position.avatarUrl,
      position: position.position,
      direction: position.direction,
    }));

  const recentActivity = paginateLedgerEntries(
    [
      ...obligations.map(normalizeObligation),
      ...transfers.map(normalizeTransfer),
    ],
    5
  ).entries;

  return {
    ...totals,
    pendingIncomingCount: pendingIncoming.length,
    pendingOutgoingCount: pendingOutgoing.length,
    pendingDebtRequestIncomingCount,
    pendingDebtRequestOutgoingCount,
    unreadNotificationCount,
    pairwise,
    recentActivity,
  };
}

export async function fetchDebtLedger(
  filters: DebtLedgerFilters = {}
): Promise<DebtLedgerPage> {
  const type = filters.type ?? "all";
  const obligationWhere: Prisma.DebtObligationWhereInput = {
    ...(filters.memberId ? obligationMemberWhere(filters.memberId) : {}),
    ...(filters.from || filters.to
      ? { createdAt: { gte: filters.from, lte: filters.to } }
      : {}),
  };
  const transferWhere: Prisma.TransferWhereInput = {
    ...(filters.memberId ? transferMemberWhere(filters.memberId) : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.from || filters.to
      ? { createdAt: { gte: filters.from, lte: filters.to } }
      : {}),
  };

  const [obligations, transfers] = await Promise.all([
    type !== "payment" && !filters.status
      ? db.debtObligation.findMany({
          where: obligationWhere,
          include: obligationInclude,
        })
      : Promise.resolve([]),
    type !== "obligation"
      ? db.transfer.findMany({
          where: transferWhere,
          include: transferInclude,
        })
      : Promise.resolve([]),
  ]);

  return paginateLedgerEntries(
    [
      ...obligations.map(normalizeObligation),
      ...transfers.map(normalizeTransfer),
    ],
    normalizeLimit(filters.limit),
    filters.cursor
  );
}

export async function fetchDebtObligations(
  filters: DebtObligationFilters = {}
): Promise<DebtLedgerPage> {
  const obligations = await db.debtObligation.findMany({
    where: {
      ...(filters.memberId ? obligationMemberWhere(filters.memberId) : {}),
      ...(filters.month
        ? { monthlySettlement: { is: { month: filters.month } } }
        : {}),
    },
    include: obligationInclude,
  });

  return paginateLedgerEntries(
    obligations.map(normalizeObligation),
    normalizeLimit(filters.limit),
    filters.cursor
  );
}

export async function fetchDebtPayments(
  filters: DebtPaymentFilters = {}
): Promise<DebtLedgerPage> {
  const direction = filters.direction ?? "all";
  if (direction !== "all" && !filters.currentUserId) {
    throw new DebtValidationError(
      "A current member is required for incoming or outgoing payment filters."
    );
  }
  const directionWhere: Prisma.TransferWhereInput =
    direction === "incoming" && filters.currentUserId
      ? { receiverId: filters.currentUserId }
      : direction === "outgoing" && filters.currentUserId
        ? { senderId: filters.currentUserId }
        : {};

  const transfers = await db.transfer.findMany({
    where: {
      ...directionWhere,
      ...(filters.memberId ? transferMemberWhere(filters.memberId) : {}),
      ...(filters.status ? { status: filters.status } : {}),
    },
    include: transferInclude,
  });

  return paginateLedgerEntries(
    transfers.map(normalizeTransfer),
    normalizeLimit(filters.limit),
    filters.cursor
  );
}

export async function fetchPairwiseDebtPosition(
  firstMemberId: string,
  secondMemberId: string
): Promise<string> {
  const [obligations, transfers] = await Promise.all([
    db.debtObligation.findMany({
      where: {
        OR: [
          { debtorId: firstMemberId, creditorId: secondMemberId },
          { debtorId: secondMemberId, creditorId: firstMemberId },
        ],
      },
      include: obligationInclude,
    }),
    db.transfer.findMany({
      where: {
        status: "accepted",
        OR: [
          { senderId: firstMemberId, receiverId: secondMemberId },
          { senderId: secondMemberId, receiverId: firstMemberId },
        ],
      },
      include: transferInclude,
    }),
  ]);

  const position = calculatePairwisePositions(
    obligations.map(obligationBalanceRecord),
    transfers.map(transferBalanceRecord)
  )[0];
  return position ? positionForMember(position, firstMemberId).toFixed(2) : "0.00";
}
