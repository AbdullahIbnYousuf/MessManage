// Date helpers — month boundaries, deadline checks, and formatting.
// All dates in this system are treated as local time (Bangladesh, UTC+6).

/**
 * Returns today's date as a YYYY-MM-DD string (local time).
 */
export function today(): string {
  return toDateString(new Date());
}

/**
 * Converts a Date object to a YYYY-MM-DD string using local time.
 */
export function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Returns the first day of a given month as a Date (local midnight).
 * @param year Full year e.g. 2024
 * @param month 1-indexed month e.g. 11 for November
 */
export function firstDayOfMonth(year: number, month: number): Date {
  return new Date(year, month - 1, 1, 0, 0, 0, 0);
}

/**
 * Returns the last day of a given month as a Date (local midnight).
 */
export function lastDayOfMonth(year: number, month: number): Date {
  return new Date(year, month, 0, 0, 0, 0, 0);
}

/**
 * Returns the first day of the current month as a Date (local midnight).
 */
export function currentMonthStart(): Date {
  const now = new Date();
  return firstDayOfMonth(now.getFullYear(), now.getMonth() + 1);
}

/**
 * Returns the last day of the current month as a Date (local midnight).
 */
export function currentMonthEnd(): Date {
  const now = new Date();
  return lastDayOfMonth(now.getFullYear(), now.getMonth() + 1);
}

/**
 * Returns the first day of the current month as a YYYY-MM-DD string.
 * Used as month reference keys (e.g. MaidCharge.month, MonthlySettlement.month)
 */
export function currentMonthKey(): string {
  return toDateString(currentMonthStart());
}

/**
 * Returns the first day of the previous calendar month as a Date (local midnight).
 */
export function previousMonthStart(): Date {
  const now = new Date();
  return firstDayOfMonth(now.getFullYear(), now.getMonth()); // getMonth() is 0-indexed = previous month
}

/**
 * Returns the last day of the previous calendar month as a Date (local midnight).
 */
export function previousMonthEnd(): Date {
  const now = new Date();
  return lastDayOfMonth(now.getFullYear(), now.getMonth()); // getMonth() is 0-indexed = previous month
}

/**
 * Returns the first day of the previous month as a YYYY-MM-DD string.
 * Used as the month key for FridgeBill.
 */
export function previousMonthKey(): string {
  return toDateString(previousMonthStart());
}

/**
 * Given a YYYY-MM-DD string, returns a Date object at local midnight.
 */
export function parseDateString(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

/**
 * Returns true if the given date string is within the current calendar month.
 */
export function isInCurrentMonth(dateStr: string): boolean {
  const date = parseDateString(dateStr);
  const start = currentMonthStart();
  const end = currentMonthEnd();
  return date >= start && date <= end;
}

/**
 * Returns true if date string A is the same calendar day as date string B.
 */
export function isSameDay(a: string, b: string): boolean {
  return a === b;
}

/**
 * Returns true if the deadline time (e.g. "22:00") has passed today (local time).
 */
export function isDeadlinePassed(deadlineTime: string): boolean {
  const now = new Date();
  const [hours, minutes] = deadlineTime.split(":").map(Number) as [number, number];
  const deadline = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    hours,
    minutes,
    0,
    0
  );
  return now >= deadline;
}

/**
 * Returns "yesterday" as a YYYY-MM-DD string (local time).
 * Used by the midnight cron job to lock the previous day's records.
 */
export function yesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return toDateString(d);
}

/**
 * Returns a human-readable date label, e.g. "May 9" or "Today".
 */
export function formatDateLabel(dateStr: string): string {
  if (dateStr === today()) return "Today";
  const date = parseDateString(dateStr);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Returns the day-of-week key for a given date string.
 * Maps to MealPattern field names.
 */
export function getDayKey(
  dateStr: string
): "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday" {
  const days = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ] as const;
  const date = parseDateString(dateStr);
  return days[date.getDay()]!;
}

/**
 * Returns all YYYY-MM-DD date strings from today to end of current month (inclusive).
 */
export function remainingDaysInMonth(): string[] {
  const result: string[] = [];
  const start = parseDateString(today());
  const end = currentMonthEnd();
  const cur = new Date(start);
  while (cur <= end) {
    result.push(toDateString(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return result;
}

/**
 * Returns all YYYY-MM-DD date strings for a given year+month (1-indexed).
 */
export function allDaysInMonth(year: number, month: number): string[] {
  const result: string[] = [];
  const start = firstDayOfMonth(year, month);
  const end = lastDayOfMonth(year, month);
  const cur = new Date(start);
  while (cur <= end) {
    result.push(toDateString(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return result;
}
