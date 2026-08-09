// POST /api/meals/cancel-today — admin-only
// Sets all today's unlocked meal records to 0.
// Works before midnight (records not yet permanently locked).
// Admin bypass: works even after the daily deadline, as long as it's before midnight.

import { requireAuth } from "@/lib/session";
import { currentMonthStart, parseDateString, today } from "@/lib/utils/dates";
import { withSerializableRetry } from "@/lib/services/debts/transactions";
import { assertMonthOpen } from "@/lib/services/month-state";
import { financialErrorResponse } from "@/lib/utils/financial-api";

export async function POST() {
  try {
    const user = await requireAuth();

    if (user.role !== "admin") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const todayStr = today();
    const todayDate = parseDateString(todayStr);

    // Safety check: The midnight cron job locks the previous day's records.
    // If the day has rolled over, todayDate is the new day, which is unlocked anyway.
    // We rely on the isLocked filter to prevent modifying locked records.

    const result = await withSerializableRetry(async (tx) => {
      await assertMonthOpen(tx, currentMonthStart());
      return tx.mealRecord.updateMany({
        where: {
          date: todayDate,
          isLocked: false,
        },
        data: { mealCount: 0 },
      });
    });

    return Response.json({
      data: {
        cancelled: result.count,
        date: todayStr,
      },
    });
  } catch (err) {
    if (err instanceof Response) return err;
    return financialErrorResponse(err, "Meal cancellation");
  }
}
