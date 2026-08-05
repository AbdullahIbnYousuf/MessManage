import { Prisma } from "@prisma/client";
import Decimal from "decimal.js";
import { db } from "@/lib/db";
import {
  buildDebtRequestCancelledNotification,
  buildDebtRequestCreatedNotification,
  buildDebtRequestResponseNotification,
} from "@/lib/domain/debts/notifications";
import { DebtError } from "@/lib/domain/debts/errors";
import { serializeDebtRequest } from "@/lib/domain/debts/requests";
import {
  parsePositiveAmount,
  validateRejectionReason,
  validateRequiredDescription,
  validateUuid,
} from "@/lib/domain/debts/validation";
import {
  deliverDebtNotifications,
  persistDebtNotifications,
} from "@/lib/services/debts/notifications";
import { withSerializableRetry } from "@/lib/services/debts/transactions";
import { debtRequestInclude } from "@/lib/queries/debt-requests";
import type { DebtRequestItem } from "@/types/debts";

type CommandDebtRequest = Prisma.DebtRequestGetPayload<{
  include: typeof debtRequestInclude;
}>;

export type DebtRequestCommandResult = {
  request: DebtRequestItem;
  created: boolean;
  notificationIds: string[];
};

export type CreateDebtRequestInput = {
  debtorUserId: unknown;
  amount: unknown;
  description: unknown;
  clientRequestId: unknown;
};

export type RespondToDebtRequestInput = {
  requestId: unknown;
  decision: unknown;
  reason?: unknown;
};

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

function parseDescription(value: unknown): string {
  try {
    return validateRequiredDescription(value);
  } catch {
    throw new DebtError(
      "INVALID_DEBT_REQUEST_DESCRIPTION",
      "Description must be between 3 and 300 characters."
    );
  }
}

function parseDecision(value: unknown): "accept" | "reject" {
  if (value !== "accept" && value !== "reject") {
    throw new DebtError("VALIDATION_ERROR", "Decision must be accept or reject.");
  }
  return value;
}

function parseReason(value: unknown): string {
  try {
    return validateRejectionReason(value);
  } catch {
    throw new DebtError(
      "REJECTION_REASON_REQUIRED",
      "A rejection reason between 3 and 300 characters is required."
    );
  }
}

function notificationInput(request: CommandDebtRequest) {
  return {
    requestId: request.id,
    requesterId: request.requesterId,
    requesterName: request.requester.nickname || request.requester.name,
    debtorId: request.debtorId,
    debtorName: request.debtor.nickname || request.debtor.name,
    amount: request.amount.toFixed(2),
  };
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

async function requireActiveMember(
  tx: Prisma.TransactionClient,
  userId: string,
  actor: boolean
): Promise<void> {
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { status: true },
  });
  if (!user || user.status !== "active") {
    throw new DebtError(
      actor ? "ACCOUNT_INACTIVE" : "MEMBER_NOT_FOUND",
      actor ? "This account is inactive." : "The selected member is not active."
    );
  }
}

function matchesCreation(
  request: CommandDebtRequest,
  requesterId: string,
  debtorId: string,
  amount: Decimal,
  description: string
): boolean {
  return request.requesterId === requesterId
    && request.debtorId === debtorId
    && request.amount.eq(amount)
    && request.description === description;
}

function duplicateConflict(): DebtError {
  return new DebtError(
    "DEBT_REQUEST_DUPLICATE_CONFLICT",
    "This request ID was already used for a different debt request."
  );
}

async function deliverAfterCommit(ids: string[], action: string): Promise<void> {
  try {
    await deliverDebtNotifications(ids);
  } catch (error) {
    console.error(`Debt request push delivery failed after ${action}.`, error);
  }
}

export async function createDebtRequest(
  requesterId: string,
  input: CreateDebtRequestInput
): Promise<DebtRequestCommandResult> {
  const debtorId = parseUuid(input.debtorUserId, "debtorUserId");
  const clientRequestId = parseUuid(input.clientRequestId, "clientRequestId");
  const amount = parseAmount(input.amount);
  const description = parseDescription(input.description);
  if (requesterId === debtorId) {
    throw new DebtError(
      "SELF_DEBT_REQUEST_NOT_ALLOWED",
      "A debt request must name another member."
    );
  }

  const run = async (): Promise<DebtRequestCommandResult> =>
    withSerializableRetry(async (tx) => {
      await requireActiveMember(tx, requesterId, true);
      await requireActiveMember(tx, debtorId, false);
      const existing = await tx.debtRequest.findUnique({
        where: { clientRequestId },
        include: debtRequestInclude,
      });
      if (existing) {
        if (!matchesCreation(existing, requesterId, debtorId, amount, description)) {
          throw duplicateConflict();
        }
        return { request: serializeDebtRequest(existing), created: false, notificationIds: [] };
      }

      const request = await tx.debtRequest.create({
        data: {
          requesterId,
          debtorId,
          amount,
          description,
          status: "pending",
          clientRequestId,
        },
        include: debtRequestInclude,
      });
      const notificationIds = await persistDebtNotifications(tx, [
        buildDebtRequestCreatedNotification(notificationInput(request)),
      ]);
      return { request: serializeDebtRequest(request), created: true, notificationIds };
    });

  let result: DebtRequestCommandResult;
  try {
    result = await run();
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
    const existing = await db.debtRequest.findUnique({
      where: { clientRequestId },
      include: debtRequestInclude,
    });
    if (!existing || !matchesCreation(existing, requesterId, debtorId, amount, description)) {
      throw duplicateConflict();
    }
    result = { request: serializeDebtRequest(existing), created: false, notificationIds: [] };
  }

  if (result.created) console.info("Debt request transition.", { requestId: result.request.id, transition: "created" });
  await deliverAfterCommit(result.notificationIds, "creation");
  return result;
}

export async function respondToDebtRequest(
  actorId: string,
  input: RespondToDebtRequestInput
): Promise<DebtRequestCommandResult> {
  const requestId = parseUuid(input.requestId, "requestId");
  const decision = parseDecision(input.decision);
  const rejectionReason = decision === "reject" ? parseReason(input.reason) : null;

  const result = await withSerializableRetry(async (tx) => {
    await requireActiveMember(tx, actorId, true);
    const request = await tx.debtRequest.findUnique({
      where: { id: requestId },
      include: debtRequestInclude,
    });
    if (!request) throw new DebtError("DEBT_REQUEST_NOT_FOUND", "Debt request not found.");
    if (request.debtorId !== actorId) {
      throw new DebtError("DEBT_REQUEST_FORBIDDEN", "Only the named debtor can respond to this request.");
    }
    if (request.status !== "pending") {
      throw new DebtError("DEBT_REQUEST_NOT_PENDING", "This debt request is no longer pending.", { currentStatus: request.status });
    }
    if (decision === "accept") await requireActiveMember(tx, request.requesterId, false);

    const respondedAt = new Date();
    const changed = await tx.debtRequest.updateMany({
      where: { id: requestId, status: "pending" },
      data: { status: decision === "accept" ? "accepted" : "rejected", rejectionReason, respondedAt },
    });
    if (changed.count !== 1) {
      const current = await tx.debtRequest.findUnique({ where: { id: requestId }, select: { status: true } });
      if (!current) throw new DebtError("DEBT_REQUEST_NOT_FOUND", "Debt request not found.");
      throw new DebtError("DEBT_REQUEST_NOT_PENDING", "This debt request is no longer pending.", { currentStatus: current.status });
    }

    if (decision === "accept") {
      await tx.debtObligation.create({
        data: {
          debtorId: request.debtorId,
          creditorId: request.requesterId,
          amount: request.amount,
          source: "member_request",
          sourceReference: `debt-request:${request.id}`,
          debtRequestId: request.id,
          createdAt: respondedAt,
        },
      });
    }
    const updated = await tx.debtRequest.findUniqueOrThrow({
      where: { id: requestId },
      include: debtRequestInclude,
    });
    const notificationIds = await persistDebtNotifications(tx, [
      buildDebtRequestResponseNotification(notificationInput(updated), decision),
    ]);
    return { request: serializeDebtRequest(updated), created: false, notificationIds };
  });

  console.info("Debt request transition.", { requestId, transition: decision === "accept" ? "accepted" : "rejected" });
  await deliverAfterCommit(result.notificationIds, decision);
  return result;
}

export async function cancelDebtRequest(
  actorId: string,
  requestIdInput: unknown
): Promise<DebtRequestCommandResult> {
  const requestId = parseUuid(requestIdInput, "requestId");
  const result = await withSerializableRetry(async (tx) => {
    await requireActiveMember(tx, actorId, true);
    const request = await tx.debtRequest.findUnique({
      where: { id: requestId },
      include: debtRequestInclude,
    });
    if (!request) throw new DebtError("DEBT_REQUEST_NOT_FOUND", "Debt request not found.");
    if (request.requesterId !== actorId) {
      throw new DebtError("DEBT_REQUEST_FORBIDDEN", "Only the requester can cancel this request.");
    }
    if (request.status !== "pending") {
      throw new DebtError("DEBT_REQUEST_NOT_PENDING", "This debt request is no longer pending.", { currentStatus: request.status });
    }

    const changed = await tx.debtRequest.updateMany({
      where: { id: requestId, status: "pending" },
      data: { status: "cancelled", cancelledAt: new Date() },
    });
    if (changed.count !== 1) {
      const current = await tx.debtRequest.findUnique({ where: { id: requestId }, select: { status: true } });
      if (!current) throw new DebtError("DEBT_REQUEST_NOT_FOUND", "Debt request not found.");
      throw new DebtError("DEBT_REQUEST_NOT_PENDING", "This debt request is no longer pending.", { currentStatus: current.status });
    }
    const updated = await tx.debtRequest.findUniqueOrThrow({ where: { id: requestId }, include: debtRequestInclude });
    const notificationIds = await persistDebtNotifications(tx, [
      buildDebtRequestCancelledNotification(notificationInput(updated)),
    ]);
    return { request: serializeDebtRequest(updated), created: false, notificationIds };
  });

  console.info("Debt request transition.", { requestId, transition: "cancelled" });
  await deliverAfterCommit(result.notificationIds, "cancellation");
  return result;
}
