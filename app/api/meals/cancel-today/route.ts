// POST /api/meals/cancel-today — admin-only
// Sets all today's unlocked meal records to 0.
// Works before midnight (records not yet permanently locked).
// Admin bypass: works even after the daily deadline, as long as it's before midnight.

import { requireAuth } from "@/lib/session";
import { db } from "@/lib/db";
import { today, parseDateString } from "@/lib/utils/dates";

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

    const result = await db.mealRecord.updateMany({
      where: {
        date: todayDate,
        isLocked: false,
      },
      data: { mealCount: 0 },
    });

    return Response.json({
      data: {
        cancelled: result.count,
        date: todayStr,
      },
    });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error(err);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
