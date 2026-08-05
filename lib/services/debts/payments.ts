import { Prisma } from "@prisma/client";
import Decimal from "decimal.js";
import { db } from "@/lib/db";
import {
  buildPaymentCancelledNotification,
  buildPaymentCreatedNotification,
  buildPaymentResponseNotification,
} from "@/lib/domain/debts/notifications";
import { DebtError } from "@/lib/domain/debts/errors";
import {
  parsePositiveAmount,
  validateOptionalDescription,
  validateRejectionReason,
  validateUuid,
} from "@/lib/domain/debts/validation";
import { serializeTransferLedgerEntry } from "@/lib/domain/debts/serialization";
import {
  transferConfirmerId,
  transferInitiation,
  transferInitiatorId,
} from "@/lib/domain/debts/transfers";
import {
  deliverDebtNotifications,
  persistDebtNotifications,
} from "@/lib/services/debts/notifications";
import { withSerializableRetry } from "@/lib/services/debts/transactions";
import type {
  DebtMember,
  DebtPaymentLedgerEntry,
  DebtTransferBalanceRecord,
} from "@/types/debts";

const commandMemberSelect = {
  id: true,
  name: true,
  nickname: true,
  avatarUrl: true,
} satisfies Prisma.UserSelect;

const commandTransferInclude = {
  sender: { select: commandMemberSelect },
  receiver: { select: commandMemberSelect },
} satisfies Prisma.TransferInclude;

type CommandTransfer = Prisma.TransferGetPayload<{
  include: typeof commandTransferInclude;
}>;

export type PaymentCommandResult = {
  payment: DebtPaymentLedgerEntry;
  created: boolean;
  notificationIds: string[];
};

export type CreatePaymentInput = {
  receiverUserId: unknown;
  amount: unknown;
  description?: unknown;
  clientRequestId: unknown;
};

export type CreateReceivedMoneyInput = {
  senderUserId: unknown;
  amount: unknown;
  description?: unknown;
  clientRequestId: unknown;
};

export type RespondToPaymentInput = {
  paymentId: unknown;
  decision: unknown;
  reason?: unknown;
};

export type CreateReturnPaymentInput = {
  paymentId: unknown;
  clientRequestId: unknown;
};

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

function transferRecord(transfer: CommandTransfer): DebtTransferBalanceRecord {
  return {
    id: transfer.id,
    senderId: transfer.senderId,
    receiverId: transfer.receiverId,
    initiatedById: transfer.initiatedById,
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

function serializeCommandTransfer(transfer: CommandTransfer): DebtPaymentLedgerEntry {
  return serializeTransferLedgerEntry(
    transferRecord(transfer),
    displayMember(transfer.sender),
    displayMember(transfer.receiver)
  );
}

function notificationInput(transfer: CommandTransfer) {
  return {
    transferId: transfer.id,
    senderId: transfer.senderId,
    senderName: transfer.sender.nickname || transfer.sender.name,
    receiverId: transfer.receiverId,
    receiverName: transfer.receiver.nickname || transfer.receiver.name,
    amount: transfer.amount.toFixed(2),
    source: transfer.source,
    initiatedBy: transferInitiation(transfer),
  };
}

function parseUuid(value: unknown, fieldName: string): string {
  try {
    return validateUuid(value, fieldName);
  } catch {
    throw new DebtError("VALIDATION_ERROR", `${fieldName} must be a valid UUID.`);
  }
}

function parseAmount(value: unknown): Decimal {
  try {
    return parsePositiveAmount(value);
  } catch {
    throw new DebtError(
      "INVALID_AMOUNT",
      "Amount must be greater than zero with at most two decimal places."
    );
  }
}

function parseDescription(value: unknown): string | null {
  try {
    return validateOptionalDescription(value);
  } catch {
    throw new DebtError(
      "INVALID_DESCRIPTION",
      "Description must be 300 characters or fewer."
    );
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError
    && error.code === "P2002"
  );
}

function isMatchingDirectRequest(
  transfer: CommandTransfer,
  actorId: string,
  receiverId: string,
  amount: Decimal,
  description: string | null
): boolean {
  return transfer.senderId === actorId
    && transfer.receiverId === receiverId
    && transferInitiatorId(transfer) === actorId
    && transfer.source === "direct"
    && transfer.reversesTransferId === null
    && transfer.amount.eq(amount)
    && transfer.description === description;
}

function isMatchingReceivedMoneyRequest(
  transfer: CommandTransfer,
  actorId: string,
  senderId: string,
  amount: Decimal,
  description: string | null
): boolean {
  return transfer.senderId === senderId
    && transfer.receiverId === actorId
    && transferInitiatorId(transfer) === actorId
    && transfer.source === "direct"
    && transfer.reversesTransferId === null
    && transfer.amount.eq(amount)
    && transfer.description === description;
}

function isMatchingReturnRequest(
  transfer: CommandTransfer,
  actorId: string,
  original: CommandTransfer
): boolean {
  return transfer.senderId === actorId
    && transfer.receiverId === original.senderId
    && transferInitiatorId(transfer) === actorId
    && transfer.source === "reversal"
    && transfer.reversesTransferId === original.id
    && transfer.amount.eq(original.amount)
    && transfer.description === null;
}

async function deliverAfterCommit(
  notificationIds: string[],
  action: string
): Promise<void> {
  try {
    await deliverDebtNotifications(notificationIds);
  } catch (error) {
    console.error(`DebtSync push delivery failed after ${action}.`, error);
  }
}

function logTransferTransition(
  paymentId: string,
  transition: "created" | "received_created" | "accepted" | "rejected" | "cancelled" | "return_created"
): void {
  console.info("DebtSync transfer transition.", { paymentId, transition });
}

async function requireActiveActor(
  tx: Prisma.TransactionClient,
  actorId: string
): Promise<void> {
  const actor = await tx.user.findUnique({
    where: { id: actorId },
    select: { status: true },
  });
  if (!actor || actor.status !== "active") {
    throw new DebtError("ACCOUNT_INACTIVE", "This account is inactive.");
  }
}

function duplicateConflict(): DebtError {
  return new DebtError(
    "DUPLICATE_REQUEST_CONFLICT",
    "This request ID was already used for a different payment."
  );
}

export async function createPayment(
  actorId: string,
  input: CreatePaymentInput
): Promise<PaymentCommandResult> {
  const receiverId = parseUuid(input.receiverUserId, "receiverUserId");
  const clientRequestId = parseUuid(input.clientRequestId, "clientRequestId");
  const amount = parseAmount(input.amount);
  const description = parseDescription(input.description);

  if (receiverId === actorId) {
    throw new DebtError(
      "SELF_PAYMENT_NOT_ALLOWED",
      "A payment must be recorded for another member."
    );
  }

  const createInTransaction = async (): Promise<PaymentCommandResult> =>
    withSerializableRetry(async (tx) => {
      await requireActiveActor(tx, actorId);

      const existing = await tx.transfer.findUnique({
        where: { clientRequestId },
        include: commandTransferInclude,
      });
      if (existing) {
        if (!isMatchingDirectRequest(existing, actorId, receiverId, amount, description)) {
          throw duplicateConflict();
        }
        return {
          payment: serializeCommandTransfer(existing),
          created: false,
          notificationIds: [],
        };
      }

      const receiver = await tx.user.findUnique({
        where: { id: receiverId },
        select: { status: true },
      });
      if (!receiver || receiver.status !== "active") {
        throw new DebtError(
          "MEMBER_NOT_FOUND",
          "The selected active member was not found."
        );
      }

      const transfer = await tx.transfer.create({
        data: {
          senderId: actorId,
          receiverId,
          initiatedById: actorId,
          amount,
          description,
          status: "pending",
          source: "direct",
          clientRequestId,
        },
        include: commandTransferInclude,
      });
      const notificationIds = await persistDebtNotifications(tx, [
        buildPaymentCreatedNotification(notificationInput(transfer)),
      ]);
      return {
        payment: serializeCommandTransfer(transfer),
        created: true,
        notificationIds,
      };
    });

  let result: PaymentCommandResult;
  try {
    result = await createInTransaction();
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
    const existing = await db.transfer.findUnique({
      where: { clientRequestId },
      include: commandTransferInclude,
    });
    if (!existing) throw error;
    if (!isMatchingDirectRequest(existing, actorId, receiverId, amount, description)) {
      throw duplicateConflict();
    }
    result = {
      payment: serializeCommandTransfer(existing),
      created: false,
      notificationIds: [],
    };
  }

  if (result.created) logTransferTransition(result.payment.id, "created");
  await deliverAfterCommit(result.notificationIds, "payment creation");
  return result;
}

export async function createReceivedMoney(
  actorId: string,
  input: CreateReceivedMoneyInput
): Promise<PaymentCommandResult> {
  const senderId = parseUuid(input.senderUserId, "senderUserId");
  const clientRequestId = parseUuid(input.clientRequestId, "clientRequestId");
  const amount = parseAmount(input.amount);
  const description = parseDescription(input.description);

  if (senderId === actorId) {
    throw new DebtError(
      "SELF_PAYMENT_NOT_ALLOWED",
      "Received money must name another member as the sender."
    );
  }

  const createInTransaction = async (): Promise<PaymentCommandResult> =>
    withSerializableRetry(async (tx) => {
      await requireActiveActor(tx, actorId);

      const existing = await tx.transfer.findUnique({
        where: { clientRequestId },
        include: commandTransferInclude,
      });
      if (existing) {
        if (!isMatchingReceivedMoneyRequest(
          existing,
          actorId,
          senderId,
          amount,
          description
        )) {
          throw duplicateConflict();
        }
        return {
          payment: serializeCommandTransfer(existing),
          created: false,
          notificationIds: [],
        };
      }

      const sender = await tx.user.findUnique({
        where: { id: senderId },
        select: { status: true },
      });
      if (!sender || sender.status !== "active") {
        throw new DebtError(
          "MEMBER_NOT_FOUND",
          "The selected active member was not found."
        );
      }

      const transfer = await tx.transfer.create({
        data: {
          senderId,
          receiverId: actorId,
          initiatedById: actorId,
          amount,
          description,
          status: "pending",
          source: "direct",
          clientRequestId,
        },
        include: commandTransferInclude,
      });
      const notificationIds = await persistDebtNotifications(tx, [
        buildPaymentCreatedNotification(notificationInput(transfer)),
      ]);
      return {
        payment: serializeCommandTransfer(transfer),
        created: true,
        notificationIds,
      };
    });

  let result: PaymentCommandResult;
  try {
    result = await createInTransaction();
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
    const existing = await db.transfer.findUnique({
      where: { clientRequestId },
      include: commandTransferInclude,
    });
    if (!existing) throw error;
    if (!isMatchingReceivedMoneyRequest(
      existing,
      actorId,
      senderId,
      amount,
      description
    )) {
      throw duplicateConflict();
    }
    result = {
      payment: serializeCommandTransfer(existing),
      created: false,
      notificationIds: [],
    };
  }

  if (result.created) {
    logTransferTransition(result.payment.id, "received_created");
  }
  await deliverAfterCommit(result.notificationIds, "received money creation");
  return result;
}

export async function respondToPayment(
  actorId: string,
  input: RespondToPaymentInput
): Promise<PaymentCommandResult> {
  const paymentId = parseUuid(input.paymentId, "paymentId");
  if (input.decision !== "accept" && input.decision !== "reject") {
    throw new DebtError(
      "VALIDATION_ERROR",
      "Decision must be accept or reject."
    );
  }
  const decision = input.decision;
  let rejectionReason: string | null = null;
  if (decision === "reject") {
    try {
      rejectionReason = validateRejectionReason(input.reason);
    } catch {
      throw new DebtError(
        "REJECTION_REASON_REQUIRED",
        "A rejection reason between 3 and 300 characters is required."
      );
    }
  }

  const result = await db.$transaction(async (tx) => {
    await requireActiveActor(tx, actorId);
    const transfer = await tx.transfer.findUnique({
      where: { id: paymentId },
      include: commandTransferInclude,
    });
    if (!transfer) {
      throw new DebtError("PAYMENT_NOT_FOUND", "Payment not found.");
    }
    if (transferConfirmerId(transfer) !== actorId) {
      throw new DebtError(
        "PAYMENT_FORBIDDEN",
        "Only the non-initiating participant can respond."
      );
    }
    if (transfer.status !== "pending") {
      throw new DebtError(
        "PAYMENT_NOT_PENDING",
        "This payment is no longer pending.",
        { currentStatus: transfer.status }
      );
    }

    const updatedCount = await tx.transfer.updateMany({
      where: { id: paymentId, status: "pending" },
      data: {
        status: decision === "accept" ? "accepted" : "rejected",
        rejectionReason,
        respondedAt: new Date(),
      },
    });
    if (updatedCount.count !== 1) {
      const current = await tx.transfer.findUnique({
        where: { id: paymentId },
        select: { status: true },
      });
      if (!current) throw new DebtError("PAYMENT_NOT_FOUND", "Payment not found.");
      throw new DebtError(
        "PAYMENT_NOT_PENDING",
        "This payment is no longer pending.",
        { currentStatus: current.status }
      );
    }

    const updated = await tx.transfer.findUniqueOrThrow({
      where: { id: paymentId },
      include: commandTransferInclude,
    });
    const notificationIds = await persistDebtNotifications(tx, [
      buildPaymentResponseNotification(notificationInput(updated), decision),
    ]);
    return {
      payment: serializeCommandTransfer(updated),
      created: false,
      notificationIds,
    };
  });

  logTransferTransition(
    result.payment.id,
    decision === "accept" ? "accepted" : "rejected"
  );
  await deliverAfterCommit(result.notificationIds, `payment ${decision}`);
  return result;
}

export async function cancelPayment(
  actorId: string,
  paymentIdInput: unknown
): Promise<PaymentCommandResult> {
  const paymentId = parseUuid(paymentIdInput, "paymentId");
  const result = await db.$transaction(async (tx) => {
    await requireActiveActor(tx, actorId);
    const transfer = await tx.transfer.findUnique({
      where: { id: paymentId },
      include: commandTransferInclude,
    });
    if (!transfer) {
      throw new DebtError("PAYMENT_NOT_FOUND", "Payment not found.");
    }
    if (transferInitiatorId(transfer) !== actorId) {
      throw new DebtError(
        "PAYMENT_FORBIDDEN",
        "Only the member who started this payment record can cancel it."
      );
    }
    if (transfer.status !== "pending") {
      throw new DebtError(
        "PAYMENT_NOT_PENDING",
        "This payment is no longer pending.",
        { currentStatus: transfer.status }
      );
    }

    const updatedCount = await tx.transfer.updateMany({
      where: { id: paymentId, status: "pending" },
      data: { status: "cancelled", cancelledAt: new Date() },
    });
    if (updatedCount.count !== 1) {
      const current = await tx.transfer.findUnique({
        where: { id: paymentId },
        select: { status: true },
      });
      if (!current) throw new DebtError("PAYMENT_NOT_FOUND", "Payment not found.");
      throw new DebtError(
        "PAYMENT_NOT_PENDING",
        "This payment is no longer pending.",
        { currentStatus: current.status }
      );
    }

    const updated = await tx.transfer.findUniqueOrThrow({
      where: { id: paymentId },
      include: commandTransferInclude,
    });
    const notificationIds = await persistDebtNotifications(tx, [
      buildPaymentCancelledNotification(notificationInput(updated)),
    ]);
    return {
      payment: serializeCommandTransfer(updated),
      created: false,
      notificationIds,
    };
  });

  logTransferTransition(result.payment.id, "cancelled");
  await deliverAfterCommit(result.notificationIds, "payment cancellation");
  return result;
}

export async function createReturnPayment(
  actorId: string,
  input: CreateReturnPaymentInput
): Promise<PaymentCommandResult> {
  const paymentId = parseUuid(input.paymentId, "paymentId");
  const clientRequestId = parseUuid(input.clientRequestId, "clientRequestId");

  const createInTransaction = async (): Promise<PaymentCommandResult> =>
    withSerializableRetry(async (tx) => {
      await requireActiveActor(tx, actorId);
      const original = await tx.transfer.findUnique({
        where: { id: paymentId },
        include: commandTransferInclude,
      });
      if (!original) {
        throw new DebtError("PAYMENT_NOT_FOUND", "Payment not found.");
      }
      if (original.receiverId !== actorId) {
        throw new DebtError(
          "PAYMENT_FORBIDDEN",
          "Only the original receiver can return this payment."
        );
      }
      if (original.status !== "accepted" || original.source !== "direct") {
        throw new DebtError(
          "REVERSAL_NOT_ALLOWED",
          "Only an accepted direct payment can be returned."
        );
      }

      const existingRequest = await tx.transfer.findUnique({
        where: { clientRequestId },
        include: commandTransferInclude,
      });
      if (existingRequest) {
        if (!isMatchingReturnRequest(existingRequest, actorId, original)) {
          throw duplicateConflict();
        }
        return {
          payment: serializeCommandTransfer(existingRequest),
          created: false,
          notificationIds: [],
        };
      }

      const activeReversal = await tx.transfer.findFirst({
        where: {
          reversesTransferId: original.id,
          status: { in: ["pending", "accepted"] },
        },
        select: { id: true },
      });
      if (activeReversal) {
        throw new DebtError(
          "ACTIVE_REVERSAL_EXISTS",
          "This payment already has an active return payment."
        );
      }

      const originalSender = await tx.user.findUnique({
        where: { id: original.senderId },
        select: { status: true },
      });
      if (!originalSender || originalSender.status !== "active") {
        throw new DebtError(
          "MEMBER_NOT_FOUND",
          "The return-payment receiver is not an active member."
        );
      }

      const reversal = await tx.transfer.create({
        data: {
          senderId: actorId,
          receiverId: original.senderId,
          initiatedById: actorId,
          amount: original.amount,
          description: null,
          status: "pending",
          source: "reversal",
          clientRequestId,
          reversesTransferId: original.id,
        },
        include: commandTransferInclude,
      });
      const notificationIds = await persistDebtNotifications(tx, [
        buildPaymentCreatedNotification(notificationInput(reversal)),
      ]);
      return {
        payment: serializeCommandTransfer(reversal),
        created: true,
        notificationIds,
      };
    });

  let result: PaymentCommandResult;
  try {
    result = await createInTransaction();
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;

    const [original, existingRequest, activeReversal] = await Promise.all([
      db.transfer.findUnique({
        where: { id: paymentId },
        include: commandTransferInclude,
      }),
      db.transfer.findUnique({
        where: { clientRequestId },
        include: commandTransferInclude,
      }),
      db.transfer.findFirst({
        where: {
          reversesTransferId: paymentId,
          status: { in: ["pending", "accepted"] },
        },
        select: { id: true },
      }),
    ]);
    if (original && existingRequest) {
      if (!isMatchingReturnRequest(existingRequest, actorId, original)) {
        throw duplicateConflict();
      }
      result = {
        payment: serializeCommandTransfer(existingRequest),
        created: false,
        notificationIds: [],
      };
    } else if (activeReversal) {
      throw new DebtError(
        "ACTIVE_REVERSAL_EXISTS",
        "This payment already has an active return payment."
      );
    } else {
      throw error;
    }
  }

  if (result.created) logTransferTransition(result.payment.id, "return_created");
  await deliverAfterCommit(result.notificationIds, "return payment creation");
  return result;
}
