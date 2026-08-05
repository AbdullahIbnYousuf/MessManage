import type {
  DebtNotificationDraft,
  DebtNotificationItem,
  DebtNotificationPage,
} from "@/types/debts";
import type { SettlementTransfer } from "@/lib/domain/settlement";
import { DebtValidationError } from "@/lib/domain/debts/validation";

type PaymentNotificationInput = {
  transferId: string;
  senderId: string;
  senderName: string;
  receiverId: string;
  receiverName: string;
  amount: string;
  source: "direct" | "reversal";
};

type DebtRequestNotificationInput = {
  requestId: string;
  requesterId: string;
  requesterName: string;
  debtorId: string;
  debtorName: string;
  amount: string;
};

export function buildObligationNotifications(
  obligationId: string,
  transfer: SettlementTransfer,
  monthKey: string
): DebtNotificationDraft[] {
  const month = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(monthKey));
  const amount = transfer.amount.toFixed(2);

  return [
    {
      userId: transfer.fromUserId,
      type: "obligation_created",
      entityType: "obligation",
      entityId: obligationId,
      title: "New settlement amount due",
      body: `You owe ${transfer.toUserName} Tk ${amount} for ${month}.`,
    },
    {
      userId: transfer.toUserId,
      type: "obligation_created",
      entityType: "obligation",
      entityId: obligationId,
      title: "New settlement amount receivable",
      body: `${transfer.fromUserName} owes you Tk ${amount} for ${month}.`,
    },
  ];
}

export function buildPaymentCreatedNotification(
  input: PaymentNotificationInput
): DebtNotificationDraft {
  const isReversal = input.source === "reversal";
  return {
    userId: input.receiverId,
    type: isReversal ? "reversal_received" : "payment_received",
    entityType: "transfer",
    entityId: input.transferId,
    title: isReversal ? "Return payment confirmation" : "Payment confirmation requested",
    body: isReversal
      ? `${input.senderName} recorded a Tk ${input.amount} return payment to you.`
      : `${input.senderName} recorded a Tk ${input.amount} payment to you. Confirm whether you received it.`,
  };
}

export function buildPaymentResponseNotification(
  input: PaymentNotificationInput,
  decision: "accept" | "reject"
): DebtNotificationDraft {
  const isReversal = input.source === "reversal";
  const accepted = decision === "accept";
  return {
    userId: input.senderId,
    type: isReversal
      ? accepted ? "reversal_accepted" : "reversal_rejected"
      : accepted ? "payment_accepted" : "payment_rejected",
    entityType: "transfer",
    entityId: input.transferId,
    title: isReversal
      ? `Return payment ${accepted ? "accepted" : "rejected"}`
      : `Payment ${accepted ? "accepted" : "rejected"}`,
    body: `${input.receiverName} ${accepted ? "accepted" : "rejected"} your recorded Tk ${input.amount} ${isReversal ? "return payment" : "payment"}.`,
  };
}

export function buildPaymentCancelledNotification(
  input: PaymentNotificationInput
): DebtNotificationDraft {
  const isReversal = input.source === "reversal";
  return {
    userId: input.receiverId,
    type: isReversal ? "reversal_cancelled" : "payment_cancelled",
    entityType: "transfer",
    entityId: input.transferId,
    title: isReversal ? "Return payment cancelled" : "Payment cancelled",
    body: `${input.senderName} cancelled the recorded Tk ${input.amount} ${isReversal ? "return payment" : "payment"}.`,
  };
}

export function buildDebtRequestCreatedNotification(
  input: DebtRequestNotificationInput
): DebtNotificationDraft {
  return {
    userId: input.debtorId,
    type: "debt_request_received",
    entityType: "debt_request",
    entityId: input.requestId,
    title: "Debt confirmation requested",
    body: `${input.requesterName} requested confirmation that you owe Tk ${input.amount}.`,
  };
}

export function buildDebtRequestResponseNotification(
  input: DebtRequestNotificationInput,
  decision: "accept" | "reject"
): DebtNotificationDraft {
  const accepted = decision === "accept";
  return {
    userId: input.requesterId,
    type: accepted ? "debt_request_accepted" : "debt_request_rejected",
    entityType: "debt_request",
    entityId: input.requestId,
    title: `Debt request ${accepted ? "accepted" : "rejected"}`,
    body: `${input.debtorName} ${accepted ? "accepted" : "rejected"} your Tk ${input.amount} debt request.`,
  };
}

export function buildDebtRequestCancelledNotification(
  input: DebtRequestNotificationInput
): DebtNotificationDraft {
  return {
    userId: input.debtorId,
    type: "debt_request_cancelled",
    entityType: "debt_request",
    entityId: input.requestId,
    title: "Debt request cancelled",
    body: `${input.requesterName} cancelled the Tk ${input.amount} debt request.`,
  };
}

type NotificationCursor = { createdAt: string; id: string };

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function encodeNotificationCursor(item: DebtNotificationItem): string {
  return Buffer.from(JSON.stringify({
    createdAt: item.createdAt,
    id: item.id,
  } satisfies NotificationCursor)).toString("base64url");
}

export function decodeNotificationCursor(cursor: string): NotificationCursor {
  try {
    const value: unknown = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (typeof value !== "object" || value === null) throw new Error();
    const candidate = value as Record<string, unknown>;
    if (
      typeof candidate.createdAt !== "string"
      || !Number.isFinite(Date.parse(candidate.createdAt))
      || typeof candidate.id !== "string"
      || !UUID_PATTERN.test(candidate.id)
    ) {
      throw new Error();
    }
    return {
      createdAt: new Date(candidate.createdAt).toISOString(),
      id: candidate.id,
    };
  } catch {
    throw new DebtValidationError("The notification cursor is invalid.");
  }
}

function compareNotifications(
  left: Pick<DebtNotificationItem, "createdAt" | "id">,
  right: Pick<DebtNotificationItem, "createdAt" | "id">
): number {
  const dateCompare = Date.parse(right.createdAt) - Date.parse(left.createdAt);
  return dateCompare !== 0 ? dateCompare : right.id.localeCompare(left.id);
}

export function paginateNotifications(
  notifications: DebtNotificationItem[],
  unreadCount: number,
  limit: number,
  cursor?: string
): DebtNotificationPage {
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw new DebtValidationError("Limit must be between 1 and 50.");
  }
  const sorted = [...notifications].sort(compareNotifications);
  const decoded = cursor ? decodeNotificationCursor(cursor) : null;
  const remaining = decoded
    ? sorted.filter((item) => compareNotifications(item, decoded) > 0)
    : sorted;
  const page = remaining.slice(0, limit);
  return {
    notifications: page,
    unreadCount,
    nextCursor: remaining.length > limit && page.length > 0
      ? encodeNotificationCursor(page[page.length - 1]!)
      : null,
  };
}
