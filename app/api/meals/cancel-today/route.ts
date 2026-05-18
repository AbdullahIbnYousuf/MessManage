// POST /api/meals/cancel-today — admin-only
// Sets all today's unlocked meal records to 0.
// Works before midnight (records not yet permanently locked).
// Admin bypass: works even after the daily deadline, as long as it's before midnight.

import { requireAuth } from "@/lib/session";
import { db } from "@/lib/db";
import { today, getNow } from "@/lib/utils/dates";

export async function POST() {
  try {
    const user = await requireAuth();

    if (user.role !== "admin") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const todayStr = today();
    const todayDate = new Date(todayStr);

    // Safety check: if somehow called after midnight and records are already locked,
    // there will be nothing to update (isLocked = false filter handles this).
    // We still block explicitly if it's past midnight to be safe.
    const now = getNow();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
    if (now >= midnight) {
      return Response.json({ error: "Today's records have been locked at midnight. Meals cannot be cancelled." }, { status: 400 });
    }

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
