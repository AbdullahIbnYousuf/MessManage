import { db } from "@/lib/db";
import { getAdminMealEditBlockReason } from "@/lib/domain/meal";
import { requireAdmin } from "@/lib/session";
import {
  currentMonthStart,
  firstDayOfMonth,
  parseDateString,
  toDateString,
} from "@/lib/utils/dates";
import type { AdminMealEditBlockReason } from "@/types";

const BLOCK_MESSAGES: Record<AdminMealEditBlockReason, string> = {
  settled_month: "This month has already been settled and is read-only.",
  finished_bulk_cycle:
    "This date belongs to a finished bulk cycle with frozen allocations.",
  before_joining: "This date is before the member joined the household.",
  after_deactivation: "This date is after the member was deactivated.",
};

class AdminMealEditConflict extends Error {
  constructor(readonly reason: AdminMealEditBlockReason) {
    super(BLOCK_MESSAGES[reason]);
  }
}

function isValidDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return parseDateString(value).toISOString().slice(0, 10) === value;
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; date: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { id, date } = await params;

    if (!isValidDateString(date)) {
      return Response.json(
        { error: "Invalid date. Use YYYY-MM-DD." },
        { status: 400 }
      );
    }

    const targetDate = parseDateString(date);
    if (targetDate > currentMonthStart()) {
      const currentMonth = currentMonthStart();
      const isSameCurrentMonth =
        targetDate.getUTCFullYear() === currentMonth.getUTCFullYear() &&
        targetDate.getUTCMonth() === currentMonth.getUTCMonth();
      if (!isSameCurrentMonth) {
        return Response.json(
          { error: "Future months are not available in the admin calendar." },
          { status: 400 }
        );
      }
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid request body." }, { status: 400 });
    }

    const mealCount =
      typeof body === "object" &&
      body !== null &&
      "mealCount" in body
        ? body.mealCount
        : null;

    if (!Number.isInteger(mealCount) || (mealCount as number) < 0) {
      return Response.json(
        { error: "Meal count must be a non-negative integer." },
        { status: 400 }
      );
    }

    const monthDate = firstDayOfMonth(
      targetDate.getUTCFullYear(),
      targetDate.getUTCMonth() + 1
    );

    const result = await db.$transaction(async (tx) => {
      const [member, record, settlement, finishedCycle] = await Promise.all([
        tx.user.findUnique({
          where: { id },
          select: { joinedAt: true, deactivatedAt: true },
        }),
        tx.mealRecord.findUnique({
          where: { userId_date: { userId: id, date: targetDate } },
        }),
        tx.monthlySettlement.findFirst({
          where: { month: monthDate },
          select: { id: true },
        }),
        tx.bulkCycle.findFirst({
          where: {
            status: "finished",
            startedAt: { lte: targetDate },
            finishedAt: { gte: targetDate },
          },
          select: { id: true },
        }),
      ]);

      if (!member) {
        return { kind: "member_not_found" as const };
      }
      if (!record) {
        return { kind: "record_not_found" as const };
      }

      const blockReason = getAdminMealEditBlockReason({
        recordDate: date,
        joinedDate: toDateString(member.joinedAt),
        deactivatedDate: member.deactivatedAt
          ? toDateString(member.deactivatedAt)
          : null,
        isMonthSettled: settlement !== null,
        isCoveredByFinishedBulkCycle: finishedCycle !== null,
      });

      if (blockReason) throw new AdminMealEditConflict(blockReason);

      const now = new Date();
      const [updated, approvedRequests] = await Promise.all([
        tx.mealRecord.update({
          where: { id: record.id },
          data: { mealCount: mealCount as number },
        }),
        tx.mealEditRequest.updateMany({
          where: { mealRecordId: record.id, status: "pending" },
          data: {
            status: "approved",
            reviewedById: admin.id,
            reviewedAt: now,
          },
        }),
      ]);

      return {
        kind: "updated" as const,
        record: updated,
        approvedRequests: approvedRequests.count,
      };
    });

    if (result.kind === "member_not_found") {
      return Response.json({ error: "Member not found." }, { status: 404 });
    }
    if (result.kind === "record_not_found") {
      return Response.json({ error: "Meal record not found." }, { status: 404 });
    }

    return Response.json({
      data: {
        id: result.record.id,
        date: result.record.date.toISOString().slice(0, 10),
        mealCount: result.record.mealCount,
        isLocked: result.record.isLocked,
        approvedRequests: result.approvedRequests,
      },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof AdminMealEditConflict) {
      return Response.json(
        { error: error.message, reason: error.reason },
        { status: 409 }
      );
    }
    console.error(error);
    return Response.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
