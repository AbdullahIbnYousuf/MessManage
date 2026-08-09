import {
  allDaysInMonth,
  firstDayOfMonth,
  getDayKey,
  lastDayOfMonth,
  parseDateString,
  today,
} from "@/lib/utils/dates";
import { withSerializableRetry } from "@/lib/services/debts/transactions";

/**
 * Ensures a user has one MealRecord for every day in an open month, then
 * returns the month. Settled months are read-only and never materialize rows.
 * This is shared by the member and admin calendars so both views behave
 * identically.
 */
export async function fetchOrCreateMealRecordsForMonth(
  userId: string,
  year: number,
  month: number
) {
  const startDate = firstDayOfMonth(year, month);
  const endDate = lastDayOfMonth(year, month);

  return withSerializableRetry(async (tx) => {
    const [existing, pattern, settlement] = await Promise.all([
      tx.mealRecord.findMany({
        where: { userId, date: { gte: startDate, lte: endDate } },
        orderBy: { date: "asc" },
      }),
      tx.mealPattern.findUnique({ where: { userId } }),
      tx.monthlySettlementRun.findUnique({
        where: { month: startDate },
        select: { id: true },
      }),
    ]);

    if (settlement) return existing;

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
      await tx.mealRecord.createMany({
        data: missingRecords,
        skipDuplicates: true,
      });
    }

    return tx.mealRecord.findMany({
      where: { userId, date: { gte: startDate, lte: endDate } },
      orderBy: { date: "asc" },
    });
  });
}
