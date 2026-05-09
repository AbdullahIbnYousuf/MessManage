// GET /api/meals/records?year=YYYY&month=MM
// Returns all meal records for the current user for the given month.
// Creates missing records from the meal pattern on the fly.

import { requireAuth } from "@/lib/session";
import { db } from "@/lib/db";
import { allDaysInMonth, getDayKey } from "@/lib/utils/dates";

export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);

    const now = new Date();
    const year = parseInt(searchParams.get("year") ?? String(now.getFullYear()), 10);
    const month = parseInt(searchParams.get("month") ?? String(now.getMonth() + 1), 10);

    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return Response.json({ error: "Invalid year or month." }, { status: 400 });
    }

    // Get existing records for this month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const existing = await db.mealRecord.findMany({
      where: { userId: user.id, date: { gte: startDate, lte: endDate } },
      orderBy: { date: "asc" },
    });

    // Get user pattern for filling in missing days
    const pattern = await db.mealPattern.findUnique({ where: { userId: user.id } });

    const existingByDate = new Map(
      existing.map((r) => [r.date.toISOString().slice(0, 10), r])
    );

    const allDays = allDaysInMonth(year, month);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Create missing records for all days
    const toCreate: Array<{ userId: string; date: Date; mealCount: number; isLocked: boolean }> = [];

    for (const dateStr of allDays) {
      if (!existingByDate.has(dateStr)) {
        const date = new Date(dateStr);
        const isPast = date < today;
        const dayKey = getDayKey(dateStr);
        const mealCount = isPast ? 0 : (pattern?.[dayKey] ?? 0);
        const isLocked = isPast;
        toCreate.push({ userId: user.id, date, mealCount, isLocked });
      }
    }

    if (toCreate.length > 0) {
      await db.mealRecord.createMany({ data: toCreate, skipDuplicates: true });
    }

    // Re-fetch all records after creating missing ones
    const allRecords = await db.mealRecord.findMany({
      where: { userId: user.id, date: { gte: startDate, lte: endDate } },
      orderBy: { date: "asc" },
    });

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
