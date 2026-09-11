// PUT /api/meals/records/[date] — update meal count for today's record only

import { requireAuth } from "@/lib/session";
import {
  compareCalendarMonths,
  firstDayOfMonth,
  getDhakaParts,
  getNow,
  isDeadlinePassed,
  parseDateString,
  today,
} from "@/lib/utils/dates";
import { canEditDirectly } from "@/lib/domain/meal";
import { withSerializableRetry } from "@/lib/services/debts/transactions";
import { assertMonthOpen } from "@/lib/services/month-state";
import { financialErrorResponse } from "@/lib/utils/financial-api";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ date: string }> }
) {
  try {
    const user = await requireAuth();
    const { date } = await params;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return Response.json({ error: "Invalid meal date." }, { status: 400 });
    }

    // Past dates cannot be edited
    if (date < today()) {
      return Response.json(
        { error: "Past meal records cannot be edited." },
        { status: 400 }
      );
    }

    const body = await request.json() as { mealCount: number };
    const { mealCount } = body;

    if (!Number.isInteger(mealCount) || mealCount < 0) {
      return Response.json({ error: "Meal count must be a non-negative integer." }, { status: 400 });
    }

    const targetDate = parseDateString(date);
    if (
      Number.isNaN(targetDate.getTime()) ||
      targetDate.toISOString().slice(0, 10) !== date
    ) {
      return Response.json({ error: "Invalid meal date." }, { status: 400 });
    }
    const parts = getDhakaParts(targetDate);
    const now = getDhakaParts(getNow());
    const monthRelation = compareCalendarMonths(
      { year: parts.y, month: parts.m },
      { year: now.y, month: now.m }
    );
    if (monthRelation > 1) {
      return Response.json(
        { error: "Meals can only be scheduled through next month." },
        { status: 400 }
      );
    }
    const monthDate = firstDayOfMonth(parts.y, parts.m);
    const updated = await withSerializableRetry(async (tx) => {
      await assertMonthOpen(tx, monthDate);
      const config = await tx.systemConfig.findFirst();
      const deadlinePassed = isDeadlinePassed(config?.mealDeadline ?? "22:00");
      const record = await tx.mealRecord.findUnique({
        where: { userId_date: { userId: user.id, date: targetDate } },
      });
      if (!record) {
        throw Response.json({ error: "Meal record not found." }, { status: 404 });
      }
      if (record.isLocked) {
        throw Response.json(
          { error: "This meal record is permanently locked." },
          { status: 400 }
        );
      }
      if (!canEditDirectly(date, deadlinePassed)) {
        const hasApprovedRequest = await tx.mealEditRequest.findFirst({
          where: {
            userId: user.id,
            mealRecordId: record.id,
            status: "approved",
            batchId: null,
          },
        });
        if (!hasApprovedRequest) {
          throw Response.json(
            { error: "The meal deadline has passed. Submit an edit request instead." },
            { status: 400 }
          );
        }
      }
      return tx.mealRecord.update({
        where: { id: record.id },
        data: { mealCount },
      });
    });

    return Response.json({
      data: {
        id: updated.id,
        date: updated.date.toISOString().slice(0, 10),
        mealCount: updated.mealCount,
        isLocked: updated.isLocked,
      },
    });
  } catch (err) {
    if (err instanceof Response) return err;
    return financialErrorResponse(err, "Meal record update");
  }
}
