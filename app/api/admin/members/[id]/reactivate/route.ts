// POST /api/admin/members/[id]/reactivate — Reactivate a member account

import { requireAdmin } from "@/lib/session";
import {
  allDaysInMonth,
  firstDayOfMonth,
  getDhakaParts,
  getNow,
  shiftCalendarMonth,
  toDateString,
} from "@/lib/utils/dates";
import { applyPatternToDate } from "@/lib/domain/meal";
import { ensureMealRecordsForMonth } from "@/lib/queries/meal-records";
import { withSerializableRetry } from "@/lib/services/debts/transactions";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;

    const actionNow = getNow();
    const now = getDhakaParts(actionNow);
    const todayStr = toDateString(actionNow);
    const currentMonth = firstDayOfMonth(now.y, now.m);
    const next = shiftCalendarMonth(now.y, now.m, 1);

    // Reactivate user + regenerate all future meal records from tomorrow onwards using pattern
    await withSerializableRetry(async (tx) => {
      const user = await tx.user.findUnique({ where: { id } });
      if (!user) {
        throw Response.json({ error: "Member not found." }, { status: 404 });
      }
      if (user.status === "active") {
        throw Response.json(
          { error: "This member is already active." },
          { status: 400 }
        );
      }
      const currentMonthSettlement = await tx.monthlySettlementRun.findUnique({
        where: { month: currentMonth },
        select: { id: true },
      });
      await tx.user.update({
        where: { id },
        data: {
          status: "active",
          deactivatedAt: null,
        },
      });

      const pattern = currentMonthSettlement
        ? null
        : await tx.mealPattern.findUnique({ where: { userId: id } });
      if (pattern !== null) {
        await ensureMealRecordsForMonth(
          tx,
          id,
          now.y,
          now.m,
          pattern,
          todayStr
        );
        await ensureMealRecordsForMonth(
          tx,
          id,
          next.year,
          next.month,
          pattern,
          todayStr
        );
        const futureDates = [
          ...allDaysInMonth(now.y, now.m).filter(d => d > todayStr),
          ...allDaysInMonth(next.year, next.month),
        ];
        for (const dateStr of futureDates) {
          const newCount = applyPatternToDate(pattern, dateStr);
          await tx.mealRecord.updateMany({
            where: { userId: id, date: new Date(dateStr), isLocked: false },
            data: { mealCount: newCount },
          });
        }
      }
    });

    return Response.json({ data: { status: "active" } });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error(err);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
