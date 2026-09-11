import { randomUUID } from "node:crypto";
import type { MealEditRequestStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  getAdminMealEditBlockReason,
  isMealDateCoveredByFinishedBulkCycle,
} from "@/lib/domain/meal";
import { mealCorrectionDelta } from "@/lib/domain/meal-corrections";
import { withSerializableRetry } from "@/lib/services/debts/transactions";
import {
  allDaysInMonth,
  compareCalendarMonths,
  firstDayOfMonth,
  getDhakaParts,
  getNow,
  isDeadlinePassed,
  lastDayOfMonth,
  parseDateString,
  today,
  toDateString,
} from "@/lib/utils/dates";
import type {
  MealCorrectionBatch,
  MealCorrectionContext,
  MealEditReview,
} from "@/types";

export type MealCorrectionErrorCode =
  | "CORRECTION_MONTH_SETTLED"
  | "CORRECTION_DATE_FROZEN"
  | "CORRECTION_DATE_NOT_ALLOWED"
  | "CORRECTION_NO_CHANGES"
  | "CORRECTION_ALREADY_PENDING"
  | "CORRECTION_REQUEST_NOT_FOUND"
  | "CORRECTION_REQUEST_TERMINAL"
  | "CORRECTION_REQUEST_STALE";

export class MealCorrectionError extends Error {
  constructor(
    readonly code: MealCorrectionErrorCode,
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

type CorrectionRow = {
  id: string;
  batchId: string | null;
  targetDate: Date | null;
  originalMealCount: number | null;
  proposedMealCount: number | null;
  status: MealEditRequestStatus;
  requestedAt: Date;
  reviewedAt: Date | null;
};

function monthBounds(month: string) {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month);
  if (!match) throw new Error("Invalid meal correction month.");
  const year = Number(match[1]);
  const monthNumber = Number(match[2]);
  return {
    year,
    monthNumber,
    start: firstDayOfMonth(year, monthNumber),
    end: lastDayOfMonth(year, monthNumber),
  };
}

function serializeBatch(rows: CorrectionRow[]): MealCorrectionBatch {
  const first = rows[0];
  if (!first?.batchId || !first.targetDate) {
    throw new Error("Invalid meal correction batch.");
  }
  const changes = rows
    .map((row) => {
      if (!row.targetDate || row.proposedMealCount === null) {
        throw new Error("Invalid meal correction item.");
      }
      return {
        requestId: row.id,
        date: toDateString(row.targetDate),
        originalMealCount: row.originalMealCount,
        proposedMealCount: row.proposedMealCount,
      };
    })
    .sort((left, right) => left.date.localeCompare(right.date));

  return {
    batchId: first.batchId,
    month: toDateString(first.targetDate).slice(0, 7),
    status: first.status,
    requestedAt: first.requestedAt.toISOString(),
    reviewedAt: first.reviewedAt?.toISOString() ?? null,
    changes,
    mealDelta: mealCorrectionDelta(changes),
  };
}

export async function fetchMealCorrectionContext(
  userId: string,
  month: string
): Promise<MealCorrectionContext> {
  const { year, monthNumber, start, end } = monthBounds(month);
  const [latestBatchItem, settlement, finishedCycles] = await Promise.all([
    db.mealEditRequest.findFirst({
      where: {
        userId,
        batchId: { not: null },
        targetDate: { gte: start, lte: end },
      },
      orderBy: { requestedAt: "desc" },
    }),
    db.monthlySettlementRun.findUnique({
      where: { month: start },
      select: { id: true },
    }),
    db.bulkCycle.findMany({
      where: {
        status: "finished",
        startedAt: { lte: end },
        finishedAt: { gte: start },
      },
      select: { startedAt: true, finishedAt: true },
    }),
  ]);
  const batchRows = latestBatchItem?.batchId
    ? await db.mealEditRequest.findMany({
        where: { batchId: latestBatchItem.batchId },
        orderBy: { targetDate: "asc" },
      })
    : [];

  const currentMonth = today().slice(0, 7);
  let legacyRequest: MealCorrectionContext["legacyRequest"] = null;
  if (month === currentMonth) {
    const todayDate = parseDateString(today());
    const legacy = await db.mealEditRequest.findFirst({
      where: {
        userId,
        batchId: null,
        mealRecord: { date: todayDate },
      },
      orderBy: { requestedAt: "desc" },
      select: { id: true, status: true },
    });
    legacyRequest = legacy;
  }

  return {
    batch: batchRows.length > 0 ? serializeBatch(batchRows) : null,
    monthSettled: settlement !== null,
    frozenDates: allDaysInMonth(year, monthNumber).filter((date) => (
      isMealDateCoveredByFinishedBulkCycle(parseDateString(date), finishedCycles)
    )),
    legacyRequest,
  };
}

export async function submitMealCorrectionBatch(input: {
  userId: string;
  month: string;
  changes: Array<{ date: string; mealCount: number }>;
}): Promise<MealCorrectionBatch> {
  const bounds = monthBounds(input.month);

  return withSerializableRetry(async (tx) => {
    const operationNow = getNow();
    const nowParts = getDhakaParts(operationNow);
    if (
      compareCalendarMonths(
        { year: bounds.year, month: bounds.monthNumber },
        { year: nowParts.y, month: nowParts.m }
      ) > 0
    ) {
      throw new MealCorrectionError(
        "CORRECTION_DATE_NOT_ALLOWED",
        "Future meals can already be edited directly.",
        400
      );
    }

    const [member, settlement, config, pending, finishedCycles, records] = await Promise.all([
      tx.user.findUnique({
        where: { id: input.userId },
        select: { joinedAt: true, deactivatedAt: true },
      }),
      tx.monthlySettlementRun.findUnique({
        where: { month: bounds.start },
        select: { id: true },
      }),
      tx.systemConfig.findFirst({ select: { mealDeadline: true } }),
      tx.mealEditRequest.findFirst({
        where: {
          userId: input.userId,
          batchId: { not: null },
          targetDate: { gte: bounds.start, lte: bounds.end },
          status: "pending",
        },
        select: { id: true },
      }),
      tx.bulkCycle.findMany({
        where: {
          status: "finished",
          startedAt: { lte: bounds.end },
          finishedAt: { gte: bounds.start },
        },
        select: { startedAt: true, finishedAt: true },
      }),
      tx.mealRecord.findMany({
        where: {
          userId: input.userId,
          date: { in: input.changes.map((change) => parseDateString(change.date)) },
        },
      }),
    ]);

    if (!member) {
      throw new MealCorrectionError(
        "CORRECTION_DATE_NOT_ALLOWED",
        "Member account not found.",
        404
      );
    }
    if (settlement) {
      throw new MealCorrectionError(
        "CORRECTION_MONTH_SETTLED",
        "This month has already been settled and is read-only.",
        409
      );
    }
    if (pending) {
      throw new MealCorrectionError(
        "CORRECTION_ALREADY_PENDING",
        "You already have a pending correction request for this month.",
        409
      );
    }

    const todayStr = toDateString(operationNow);
    const deadlinePassed = isDeadlinePassed(
      config?.mealDeadline ?? "22:00",
      operationNow
    );
    const joinedDate = toDateString(member.joinedAt);
    const deactivatedDate = member.deactivatedAt
      ? toDateString(member.deactivatedAt)
      : null;
    const recordByDate = new Map(records.map((record) => [toDateString(record.date), record]));
    const prepared = [] as Array<{
      userId: string;
      mealRecordId: string | null;
      batchId: string;
      targetDate: Date;
      originalMealCount: number | null;
      proposedMealCount: number;
      status: "pending";
      requestedAt: Date;
    }>;
    const batchId = randomUUID();

    for (const change of input.changes) {
      const targetDate = parseDateString(change.date);
      if (change.date > todayStr || (change.date === todayStr && !deadlinePassed)) {
        throw new MealCorrectionError(
          "CORRECTION_DATE_NOT_ALLOWED",
          `${change.date} can already be edited directly.`,
          400
        );
      }
      const blockReason = getAdminMealEditBlockReason({
        recordDate: change.date,
        joinedDate,
        deactivatedDate,
        isMonthSettled: false,
        isCoveredByFinishedBulkCycle: isMealDateCoveredByFinishedBulkCycle(
          targetDate,
          finishedCycles
        ),
      });
      if (blockReason) {
        throw new MealCorrectionError(
          blockReason === "finished_bulk_cycle"
            ? "CORRECTION_DATE_FROZEN"
            : "CORRECTION_DATE_NOT_ALLOWED",
          blockReason === "finished_bulk_cycle"
            ? `${change.date} is covered by a finished bulk cycle.`
            : `${change.date} is outside your active membership period.`,
          409
        );
      }

      const record = recordByDate.get(change.date);
      if (record && record.mealCount === change.mealCount) continue;
      prepared.push({
        userId: input.userId,
        mealRecordId: record?.id ?? null,
        batchId,
        targetDate,
        originalMealCount: record?.mealCount ?? null,
        proposedMealCount: change.mealCount,
        status: "pending",
        requestedAt: operationNow,
      });
    }

    if (prepared.length === 0) {
      throw new MealCorrectionError(
        "CORRECTION_NO_CHANGES",
        "None of the proposed meal counts are different from the saved records.",
        400
      );
    }

    await tx.mealEditRequest.createMany({ data: prepared });
    const rows = await tx.mealEditRequest.findMany({
      where: { batchId },
      orderBy: { targetDate: "asc" },
    });
    return serializeBatch(rows);
  });
}

export async function listPendingMealEditReviews(): Promise<MealEditReview[]> {
  const rows = await db.mealEditRequest.findMany({
    where: { status: "pending" },
    include: {
      user: { select: { id: true, name: true, avatarUrl: true } },
      mealRecord: { select: { date: true, mealCount: true } },
    },
    orderBy: { requestedAt: "asc" },
  });
  const reviews: MealEditReview[] = [];
  const seenBatches = new Set<string>();

  for (const row of rows) {
    if (!row.batchId) {
      if (!row.mealRecord) continue;
      reviews.push({
        kind: "legacy",
        id: row.id,
        requestedAt: row.requestedAt.toISOString(),
        user: row.user,
        mealRecord: {
          date: toDateString(row.mealRecord.date),
          mealCount: row.mealRecord.mealCount,
        },
      });
      continue;
    }
    if (seenBatches.has(row.batchId)) continue;
    seenBatches.add(row.batchId);
    const batchRows = rows.filter((candidate) => candidate.batchId === row.batchId);
    const batch = serializeBatch(batchRows);
    reviews.push({
      kind: "batch",
      id: row.batchId,
      batchId: row.batchId,
      requestedAt: batch.requestedAt,
      user: row.user,
      month: batch.month,
      changes: batch.changes,
      mealDelta: batch.mealDelta,
    });
  }

  return reviews.sort((left, right) => left.requestedAt.localeCompare(right.requestedAt));
}

async function invalidateBatchIds(
  tx: Prisma.TransactionClient,
  batchIds: string[],
  reviewedById?: string
): Promise<number> {
  if (batchIds.length === 0) return 0;
  const result = await tx.mealEditRequest.updateMany({
    where: { batchId: { in: batchIds }, status: "pending" },
    data: {
      status: "invalidated",
      reviewedAt: getNow(),
      ...(reviewedById && { reviewedById }),
    },
  });
  return result.count;
}

export async function invalidatePendingMealCorrectionsForRange(
  tx: Prisma.TransactionClient,
  start: Date,
  end: Date,
  reviewedById?: string
): Promise<number> {
  const overlapping = await tx.mealEditRequest.findMany({
    where: {
      batchId: { not: null },
      status: "pending",
      targetDate: { gte: start, lte: end },
    },
    select: { batchId: true },
    distinct: ["batchId"],
  });
  return invalidateBatchIds(
    tx,
    overlapping.flatMap((row) => row.batchId ? [row.batchId] : []),
    reviewedById
  );
}

export async function respondToMealEditReview(input: {
  adminId: string;
  reviewId: string;
  action: "approve" | "reject";
}): Promise<{ status: "approved" | "rejected"; changedMeals: number }> {
  return withSerializableRetry(async (tx) => {
    const seed = await tx.mealEditRequest.findFirst({
      where: { OR: [{ id: input.reviewId }, { batchId: input.reviewId }] },
      include: { mealRecord: true },
    });
    if (!seed) {
      throw new MealCorrectionError(
        "CORRECTION_REQUEST_NOT_FOUND",
        "Meal correction request not found.",
        404
      );
    }

    if (!seed.batchId) {
      if (seed.status !== "pending") {
        throw new MealCorrectionError(
          "CORRECTION_REQUEST_TERMINAL",
          "This request has already been reviewed or expired.",
          409
        );
      }
      if (!seed.mealRecord || seed.mealRecord.isLocked) {
        throw new MealCorrectionError(
          "CORRECTION_REQUEST_STALE",
          "The meal record is already locked and this legacy request can no longer be approved.",
          409
        );
      }
      const status = input.action === "approve" ? "approved" : "rejected";
      const changed = await tx.mealEditRequest.updateMany({
        where: { id: seed.id, status: "pending" },
        data: { status, reviewedById: input.adminId, reviewedAt: getNow() },
      });
      if (changed.count !== 1) {
        throw new MealCorrectionError(
          "CORRECTION_REQUEST_TERMINAL",
          "This request was already reviewed.",
          409
        );
      }
      return { status, changedMeals: 0 };
    }

    const items = await tx.mealEditRequest.findMany({
      where: { batchId: seed.batchId },
      orderBy: { targetDate: "asc" },
    });
    if (items.length === 0 || items.some((item) => item.status !== "pending")) {
      throw new MealCorrectionError(
        "CORRECTION_REQUEST_TERMINAL",
        "This correction request is no longer pending.",
        409
      );
    }
    if (input.action === "reject") {
      const result = await tx.mealEditRequest.updateMany({
        where: { batchId: seed.batchId, status: "pending" },
        data: { status: "rejected", reviewedById: input.adminId, reviewedAt: getNow() },
      });
      if (result.count !== items.length) {
        throw new MealCorrectionError(
          "CORRECTION_REQUEST_TERMINAL",
          "This correction request changed while it was being reviewed.",
          409
        );
      }
      return { status: "rejected", changedMeals: 0 };
    }

    const targetDates = items.map((item) => {
      if (!item.targetDate || item.proposedMealCount === null) {
        throw new MealCorrectionError(
          "CORRECTION_REQUEST_STALE",
          "This correction request contains incomplete data.",
          409
        );
      }
      return item.targetDate;
    });
    const firstTarget = targetDates[0]!;
    const batchMonth = toDateString(firstTarget).slice(0, 7);
    if (
      items.some((item) => (
        item.userId !== seed.userId
        || !item.targetDate
        || toDateString(item.targetDate).slice(0, 7) !== batchMonth
      ))
    ) {
      throw new MealCorrectionError(
        "CORRECTION_REQUEST_STALE",
        "This correction request contains inconsistent batch data.",
        409
      );
    }
    const firstParts = getDhakaParts(firstTarget);
    const monthStart = firstDayOfMonth(firstParts.y, firstParts.m);
    const monthEnd = lastDayOfMonth(firstParts.y, firstParts.m);
    const [member, settlement, finishedCycles, currentRecords] = await Promise.all([
      tx.user.findUnique({
        where: { id: seed.userId },
        select: { joinedAt: true, deactivatedAt: true },
      }),
      tx.monthlySettlementRun.findUnique({
        where: { month: monthStart },
        select: { id: true },
      }),
      tx.bulkCycle.findMany({
        where: {
          status: "finished",
          startedAt: { lte: monthEnd },
          finishedAt: { gte: monthStart },
        },
        select: { startedAt: true, finishedAt: true },
      }),
      tx.mealRecord.findMany({
        where: { userId: seed.userId, date: { in: targetDates } },
      }),
    ]);
    if (!member) {
      throw new MealCorrectionError(
        "CORRECTION_REQUEST_STALE",
        "The member account no longer exists.",
        409
      );
    }
    if (settlement) {
      throw new MealCorrectionError(
        "CORRECTION_MONTH_SETTLED",
        "This month has already been settled.",
        409
      );
    }

    const joinedDate = toDateString(member.joinedAt);
    const deactivatedDate = member.deactivatedAt
      ? toDateString(member.deactivatedAt)
      : null;
    const currentByDate = new Map(
      currentRecords.map((record) => [toDateString(record.date), record])
    );
    for (const item of items) {
      const targetDate = item.targetDate as Date;
      const date = toDateString(targetDate);
      const current = currentByDate.get(date);
      const blockReason = getAdminMealEditBlockReason({
        recordDate: date,
        joinedDate,
        deactivatedDate,
        isMonthSettled: false,
        isCoveredByFinishedBulkCycle: isMealDateCoveredByFinishedBulkCycle(
          targetDate,
          finishedCycles
        ),
      });
      if (blockReason) {
        throw new MealCorrectionError(
          blockReason === "finished_bulk_cycle"
            ? "CORRECTION_DATE_FROZEN"
            : "CORRECTION_DATE_NOT_ALLOWED",
          blockReason === "finished_bulk_cycle"
            ? `${date} is now covered by a finished bulk cycle.`
            : `${date} is outside the member's active period.`,
          409
        );
      }
      const originalStillMatches = item.originalMealCount === null
        ? !current
        : current?.mealCount === item.originalMealCount;
      if (!originalStillMatches) {
        throw new MealCorrectionError(
          "CORRECTION_REQUEST_STALE",
          `${date} changed after this request was submitted.`,
          409
        );
      }
    }

    for (const item of items) {
      const targetDate = item.targetDate as Date;
      const date = toDateString(targetDate);
      const current = currentByDate.get(date);
      if (current) {
        await tx.mealRecord.update({
          where: { id: current.id },
          data: { mealCount: item.proposedMealCount as number },
        });
      } else {
        await tx.mealRecord.create({
          data: {
            userId: seed.userId,
            date: targetDate,
            mealCount: item.proposedMealCount as number,
            isLocked: date < today(),
          },
        });
      }
    }
    const reviewedAt = getNow();
    const result = await tx.mealEditRequest.updateMany({
      where: { batchId: seed.batchId, status: "pending" },
      data: { status: "approved", reviewedById: input.adminId, reviewedAt },
    });
    if (result.count !== items.length) {
      throw new MealCorrectionError(
        "CORRECTION_REQUEST_TERMINAL",
        "This correction request changed while it was being reviewed.",
        409
      );
    }
    return { status: "approved", changedMeals: items.length };
  });
}
