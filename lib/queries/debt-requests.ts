import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  paginateDebtRequests,
  serializeDebtRequest,
} from "@/lib/domain/debts/requests";
import type {
  DebtRequestFilters,
  DebtRequestItem,
  DebtRequestPage,
} from "@/types/debts";

export const debtRequestMemberSelect = {
  id: true,
  name: true,
  nickname: true,
  avatarUrl: true,
} satisfies Prisma.UserSelect;

export const debtRequestInclude = {
  requester: { select: debtRequestMemberSelect },
  debtor: { select: debtRequestMemberSelect },
  obligation: { select: { id: true } },
} satisfies Prisma.DebtRequestInclude;

function participantWhere(userId: string): Prisma.DebtRequestWhereInput {
  return { OR: [{ requesterId: userId }, { debtorId: userId }] };
}

export async function fetchDebtRequests(
  filters: DebtRequestFilters
): Promise<DebtRequestPage> {
  const direction = filters.direction ?? "all";
  const directionWhere: Prisma.DebtRequestWhereInput = direction === "incoming"
    ? { debtorId: filters.userId }
    : direction === "outgoing"
      ? { requesterId: filters.userId }
      : participantWhere(filters.userId);
  const requests = await db.debtRequest.findMany({
    where: {
      ...directionWhere,
      ...(filters.status ? { status: filters.status } : {}),
    },
    include: debtRequestInclude,
  });

  return paginateDebtRequests(
    requests.map(serializeDebtRequest),
    filters.limit ?? 25,
    filters.cursor
  );
}

export async function fetchDebtRequestDetail(
  userId: string,
  requestId: string
): Promise<DebtRequestItem | null> {
  const request = await db.debtRequest.findFirst({
    where: { id: requestId, ...participantWhere(userId) },
    include: debtRequestInclude,
  });
  return request ? serializeDebtRequest(request) : null;
}
