import { db } from "@/lib/db";
import {
  allDaysInMonth,
  firstDayOfMonth,
  getDayKey,
  lastDayOfMonth,
  parseDateString,
  today,
} from "@/lib/utils/dates";

/**
 * Ensures a user has one MealRecord for every day in a month, then returns the
 * complete month. This is shared by the member and admin calendars so both
 * views materialize missing records identically.
 */
export async function fetchOrCreateMealRecordsForMonth(
  userId: string,
  year: number,
  month: number
) {
  const startDate = firstDayOfMonth(year, month);
  const endDate = lastDayOfMonth(year, month);

  const [existing, pattern] = await Promise.all([
    db.mealRecord.findMany({
      where: { userId, date: { gte: startDate, lte: endDate } },
      orderBy: { date: "asc" },
    }),
    db.mealPattern.findUnique({ where: { userId } }),
  ]);

  const existingDates = new Set(
    existing.map((record) => record.date.toISOString().slice(0, 10))
  );
  const todayStr = today();
  const missingRecords = allDaysInMonth(year, month)
    .filter((dateStr) => !existingDates.has(dateStr))
    .map((dateStr) => {
      const isPast = dateStr < todayStr;
      const dayKey = getDayKey(dateStr);
      return {
        userId,
        date: parseDateString(dateStr),
        mealCount: isPast ? 0 : (pattern?.[dayKey] ?? 0),
        isLocked: isPast,
      };
    });

  if (missingRecords.length > 0) {
    await db.mealRecord.createMany({
      data: missingRecords,
      skipDuplicates: true,
    });
  }

  return db.mealRecord.findMany({
    where: { userId, date: { gte: startDate, lte: endDate } },
    orderBy: { date: "asc" },
  });
}
