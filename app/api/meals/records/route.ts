// GET /api/meals/records?year=YYYY&month=MM
// Returns all meal records for the current user for the given month.
// Creates missing records from the meal pattern only while the month is open.

import { requireAuth } from "@/lib/session";
import {
  compareCalendarMonths,
  getNow,
  getDhakaParts,
} from "@/lib/utils/dates";
import {
  fetchOrCreateMealRecordsForMonth,
  fetchRollingMealRecords,
} from "@/lib/queries/meal-records";

export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);

    const now = getNow();
    const { y: defaultY, m: defaultM } = getDhakaParts(now);
    const year = parseInt(searchParams.get("year") ?? String(defaultY), 10);
    const month = parseInt(searchParams.get("month") ?? String(defaultM), 10);

    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return Response.json({ error: "Invalid year or month." }, { status: 400 });
    }

    const relation = compareCalendarMonths(
      { year, month },
      { year: defaultY, month: defaultM }
    );
    if (relation > 1) {
      return Response.json(
        { error: "Meals can only be scheduled through next month." },
        { status: 400 }
      );
    }

    const allRecords = relation >= 0
      ? await fetchRollingMealRecords(user.id, year, month)
      : await fetchOrCreateMealRecordsForMonth(user.id, year, month);

    return Response.json({
      data: allRecords.map((r) => ({
        id: r.id,
        date: r.date.toISOString().slice(0, 10),
        mealCount: r.mealCount,
        isLocked: r.isLocked,
      })),
    });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error(err);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
