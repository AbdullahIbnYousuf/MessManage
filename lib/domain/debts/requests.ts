import type { DebtRequestItem, DebtRequestPage } from "@/types/debts";
import type { DebtRequestStatus } from "@prisma/client";
import { DebtValidationError } from "@/lib/domain/debts/validation";

type RequestCursor = { createdAt: string; id: string };

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RequestMemberRecord = {
  id: string;
  name: string;
  nickname: string | null;
  avatarUrl: string | null;
};

export function serializeDebtRequest(request: {
  id: string;
  amount: { toFixed(decimalPlaces: number): string };
  description: string;
  status: DebtRequestStatus;
  rejectionReason: string | null;
  createdAt: Date;
  respondedAt: Date | null;
  cancelledAt: Date | null;
  requester: RequestMemberRecord;
  debtor: RequestMemberRecord;
  obligation: { id: string } | null;
}): DebtRequestItem {
  return {
    id: request.id,
    amount: request.amount.toFixed(2),
    description: request.description,
    status: request.status,
    rejectionReason: request.rejectionReason,
    createdAt: request.createdAt.toISOString(),
    respondedAt: request.respondedAt?.toISOString() ?? null,
    cancelledAt: request.cancelledAt?.toISOString() ?? null,
    obligationId: request.obligation?.id ?? null,
    requester: {
      id: request.requester.id,
      name: request.requester.nickname || request.requester.name,
      avatarUrl: request.requester.avatarUrl,
    },
    debtor: {
      id: request.debtor.id,
      name: request.debtor.nickname || request.debtor.name,
      avatarUrl: request.debtor.avatarUrl,
    },
  };
}

function compareRequests(
  left: Pick<DebtRequestItem, "createdAt" | "id">,
  right: Pick<DebtRequestItem, "createdAt" | "id">
): number {
  const dateCompare = Date.parse(right.createdAt) - Date.parse(left.createdAt);
  return dateCompare !== 0 ? dateCompare : right.id.localeCompare(left.id);
}

function encodeCursor(item: DebtRequestItem): string {
  return Buffer.from(JSON.stringify({
    createdAt: item.createdAt,
    id: item.id,
  } satisfies RequestCursor)).toString("base64url");
}

function decodeCursor(cursor: string): RequestCursor {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (typeof parsed !== "object" || parsed === null) throw new Error();
    const value = parsed as Record<string, unknown>;
    if (
      typeof value.createdAt !== "string"
      || !Number.isFinite(Date.parse(value.createdAt))
      || typeof value.id !== "string"
      || !UUID_PATTERN.test(value.id)
    ) throw new Error();
    return { createdAt: new Date(value.createdAt).toISOString(), id: value.id };
  } catch {
    throw new DebtValidationError("The debt request cursor is invalid.");
  }
}

export function paginateDebtRequests(
  requests: DebtRequestItem[],
  limit: number,
  cursor?: string
): DebtRequestPage {
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw new DebtValidationError("Limit must be between 1 and 50.");
  }
  const sorted = [...requests].sort(compareRequests);
  const decoded = cursor ? decodeCursor(cursor) : null;
  const remaining = decoded
    ? sorted.filter((request) => compareRequests(request, decoded) > 0)
    : sorted;
  const page = remaining.slice(0, limit);
  return {
    requests: page,
    nextCursor: remaining.length > limit && page.length > 0
      ? encodeCursor(page[page.length - 1]!)
      : null,
  };
}
