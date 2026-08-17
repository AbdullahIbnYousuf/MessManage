// GET  /api/meals/pattern — get current user's meal pattern
// PUT  /api/meals/pattern — update pattern and propagate to future meal records

import { requireAuth } from "@/lib/session";
import { db } from "@/lib/db";
import { applyPatternToDate } from "@/lib/domain/meal";
import { ensureMealRecordsForMonth } from "@/lib/queries/meal-records";
import type { MealPattern } from "@/types";
import {
  allDaysInMonth,
  firstDayOfMonth,
  getDhakaParts,
  getNow,
  isDeadlinePassed,
  shiftCalendarMonth,
  toDateString,
} from "@/lib/utils/dates";
import { withSerializableRetry } from "@/lib/services/debts/transactions";
import { assertMonthOpen } from "@/lib/services/month-state";
import { financialErrorResponse } from "@/lib/utils/financial-api";

export async function GET() {
  try {
    const user = await requireAuth();

    const pattern = await db.mealPattern.findUnique({
      where: { userId: user.id },
    });

    if (!pattern) {
      // Return zeros if somehow no pattern exists yet
      return Response.json({
        data: {
          monday: 0, tuesday: 0, wednesday: 0, thursday: 0,
          friday: 0, saturday: 0, sunday: 0,
        },
      });
    }

    return Response.json({ data: pattern });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error(err);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireAuth();
    const body = await request.json() as Partial<MealPattern>;

    // Validate all values are non-negative integers
    const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
    const data: MealPattern = { monday: 0, tuesday: 0, wednesday: 0, thursday: 0, friday: 0, saturday: 0, sunday: 0 };

    for (const day of days) {
      const val = body[day];
      if (val === undefined || !Number.isInteger(val) || val < 0) {
        return Response.json({ error: `Invalid value for ${day}. Must be a non-negative integer.` }, { status: 400 });
      }
      data[day] = val;
    }

    const operationNow = getNow();
    const now = getDhakaParts(operationNow);
    const todayStr = toDateString(operationNow);
    const next = shiftCalendarMonth(now.y, now.m, 1);

    await withSerializableRetry(async (tx) => {
      const monthDate = firstDayOfMonth(now.y, now.m);
      const nextMonthDate = firstDayOfMonth(next.year, next.month);
      await assertMonthOpen(tx, monthDate);
      await assertMonthOpen(tx, nextMonthDate);
      const config = await tx.systemConfig.findFirst({
        select: { mealDeadline: true },
      });
      const deadlinePassed = isDeadlinePassed(
        config?.mealDeadline ?? "22:00",
        operationNow
      );
      const propagationDates = allDaysInMonth(now.y, now.m).filter(
        (dateStr) =>
          dateStr >= todayStr && (!deadlinePassed || dateStr > todayStr)
      );

      const savedPattern = await tx.mealPattern.upsert({
        where: { userId: user.id },
        update: { ...data },
        create: { userId: user.id, ...data },
      });

      await ensureMealRecordsForMonth(
        tx,
        user.id,
        now.y,
        now.m,
        savedPattern,
        todayStr
      );
      await ensureMealRecordsForMonth(
        tx,
        user.id,
        next.year,
        next.month,
        savedPattern,
        todayStr
      );

      const datesToUpdate = [
        ...propagationDates,
        ...allDaysInMonth(next.year, next.month),
      ];
      for (const dateStr of datesToUpdate) {
        const newCount = applyPatternToDate(savedPattern, dateStr);
        await tx.mealRecord.updateMany({
          where: { userId: user.id, date: new Date(dateStr), isLocked: false },
          data: { mealCount: newCount },
        });
      }
    });

    return Response.json({ data: { updated: true } });
  } catch (err) {
    if (err instanceof Response) return err;
    return financialErrorResponse(err, "Meal pattern update");
  }
}
