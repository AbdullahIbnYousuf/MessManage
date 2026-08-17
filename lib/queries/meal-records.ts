import {
  allDaysInMonth,
  compareCalendarMonths,
  firstDayOfMonth,
  getDhakaParts,
  getDayKey,
  getNow,
  lastDayOfMonth,
  parseDateString,
  shiftCalendarMonth,
  today,
  toDateString,
} from "@/lib/utils/dates";
import { withSerializableRetry } from "@/lib/services/debts/transactions";
import type { Prisma } from "@prisma/client";
import type { MealPattern } from "@/types";

type PatternValues = Pick<
  MealPattern,
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday"
>;

async function readMealRecordsForMonth(
  tx: Prisma.TransactionClient,
  userId: string,
  year: number,
  month: number
) {
  return tx.mealRecord.findMany({
    where: {
      userId,
      date: {
        gte: firstDayOfMonth(year, month),
        lte: lastDayOfMonth(year, month),
      },
    },
    orderBy: { date: "asc" },
  });
}

/**
 * Materializes any missing records for an open current/future month. Callers
 * decide which months are eligible; historical browsing must never call this.
 */
export async function ensureMealRecordsForMonth(
  tx: Prisma.TransactionClient,
  userId: string,
  year: number,
  month: number,
  pattern: PatternValues | null,
  referenceDate = today()
) {
  const startDate = firstDayOfMonth(year, month);
  const [existing, settlement] = await Promise.all([
    readMealRecordsForMonth(tx, userId, year, month),
    tx.monthlySettlementRun.findUnique({
      where: { month: startDate },
      select: { id: true },
    }),
  ]);

  if (settlement) return existing;

  const existingDates = new Set(
    existing.map((record) => record.date.toISOString().slice(0, 10))
  );
  const missingRecords = allDaysInMonth(year, month)
    .filter((dateStr) => !existingDates.has(dateStr))
    .map((dateStr) => {
      const isPast = dateStr < referenceDate;
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

  return readMealRecordsForMonth(tx, userId, year, month);
}

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
  return withSerializableRetry(async (tx) => {
    const operationNow = getNow();
    const now = getDhakaParts(operationNow);
    const relation = compareCalendarMonths(
      { year, month },
      { year: now.y, month: now.m }
    );

    if (relation < 0 || relation > 1) {
      return readMealRecordsForMonth(tx, userId, year, month);
    }

    const pattern = await tx.mealPattern.findUnique({ where: { userId } });
    return ensureMealRecordsForMonth(
      tx,
      userId,
      year,
      month,
      pattern,
      toDateString(operationNow)
    );
  });
}

/**
 * Ensures the member's rolling current + next-month schedule exists and then
 * returns the requested month from the same serializable snapshot.
 */
export async function fetchRollingMealRecords(
  userId: string,
  requestedYear: number,
  requestedMonth: number
) {
  return withSerializableRetry(async (tx) => {
    const operationNow = getNow();
    const now = getDhakaParts(operationNow);
    const todayStr = toDateString(operationNow);
    const current = { year: now.y, month: now.m };
    const next = shiftCalendarMonth(current.year, current.month, 1);
    const pattern = await tx.mealPattern.findUnique({ where: { userId } });

    await ensureMealRecordsForMonth(
      tx,
      userId,
      current.year,
      current.month,
      pattern,
      todayStr
    );
    await ensureMealRecordsForMonth(
      tx,
      userId,
      next.year,
      next.month,
      pattern,
      todayStr
    );

    return readMealRecordsForMonth(
      tx,
      userId,
      requestedYear,
      requestedMonth
    );
  });
}
