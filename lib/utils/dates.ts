// Date helpers — month boundaries, deadline checks, and formatting.
// All dates in this system are treated as local time (Bangladesh, UTC+6).

/**
 * Returns the current time as a Date object.
 *
 * In development, if MOCK_CURRENT_TIME is set in your environment, that value
 * is used instead of the real clock. This lets you test time-sensitive features
 * (midnight locking, month-end settlement, deadline checks) without waiting for
 * real time to pass.
 *
 * Usage in .env.local:
 *   MOCK_CURRENT_TIME=2024-11-30T23:58:00
 *
 * Remove or leave blank to use real time.
 * This variable is ignored in production — it only works when NODE_ENV=development.
 */
export function getNow(): Date {
  if (
    process.env.NODE_ENV === "development" &&
    process.env.MOCK_CURRENT_TIME
  ) {
    const mocked = new Date(process.env.MOCK_CURRENT_TIME);
    if (!isNaN(mocked.getTime())) return mocked;
  }
  return new Date();
}

/**
 * Helper to extract Dhaka local time parts from any Date object.
 * This makes calculations immune to the server's time zone (e.g. Vercel UTC).
 */
export function getDhakaParts(date: Date) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const get = (type: string) => Number(parts.find(p => p.type === type)?.value);
  let h = get("hour");
  if (h === 24) h = 0;
  return {
    y: get("year"),
    m: get("month"), // 1-12
    d: get("day"),
    h,
    min: get("minute"),
    s: get("second"),
  };
}

/**
 * Returns today's date as a YYYY-MM-DD string (Dhaka time).
 */
export function today(): string {
  return toDateString(getNow());
}

/**
 * Converts a Date object to a YYYY-MM-DD string using Dhaka time.
 */
export function toDateString(date: Date): string {
  const { y, m, d } = getDhakaParts(date);
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * Returns the first day of a given month as a UTC midnight Date.
 * @param year Full year e.g. 2024
 * @param month 1-indexed month e.g. 11 for November
 */
export function firstDayOfMonth(year: number, month: number): Date {
  return new Date(Date.UTC(year, month - 1, 1));
}

/**
 * Returns the last day of a given month as a UTC midnight Date.
 */
export function lastDayOfMonth(year: number, month: number): Date {
  return new Date(Date.UTC(year, month, 0));
}

/**
 * Returns the first day of the current month as a UTC midnight Date.
 */
export function currentMonthStart(): Date {
  const { y, m } = getDhakaParts(getNow());
  return firstDayOfMonth(y, m);
}

/**
 * Returns the last day of the current month as a UTC midnight Date.
 */
export function currentMonthEnd(): Date {
  const { y, m } = getDhakaParts(getNow());
  return lastDayOfMonth(y, m);
}

/**
 * Returns the first day of the current month as a YYYY-MM-DD string.
 * Used as month reference keys (e.g. MaidCharge.month, MonthlySettlement.month)
 */
export function currentMonthKey(): string {
  return toDateString(currentMonthStart());
}

/**
 * Returns the first day of the previous calendar month as a UTC midnight Date.
 */
export function previousMonthStart(): Date {
  const { y, m } = getDhakaParts(getNow());
  let prevYear = y;
  let prevMonth = m - 1;
  if (prevMonth === 0) {
    prevMonth = 12;
    prevYear--;
  }
  return firstDayOfMonth(prevYear, prevMonth);
}

/**
 * Returns the last day of the previous calendar month as a UTC midnight Date.
 */
export function previousMonthEnd(): Date {
  const { y, m } = getDhakaParts(getNow());
  let prevYear = y;
  let prevMonth = m - 1;
  if (prevMonth === 0) {
    prevMonth = 12;
    prevYear--;
  }
  return lastDayOfMonth(prevYear, prevMonth);
}

/**
 * Returns the first day of the previous month as a YYYY-MM-DD string.
 * Used as the month key for FridgeBill.
 */
export function previousMonthKey(): string {
  return toDateString(previousMonthStart());
}

/**
 * Given a YYYY-MM-DD string, returns a Date object at UTC midnight.
 */
export function parseDateString(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d));
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
 * Returns true if the deadline time (e.g. "22:00") has passed today in Dhaka time.
 */
export function isDeadlinePassed(deadlineTime: string): boolean {
  const now = getNow();
  const dhaka = getDhakaParts(now);
  const [hours, minutes] = deadlineTime.split(":").map(Number) as [number, number];
  
  if (dhaka.h > hours) return true;
  if (dhaka.h === hours && dhaka.min >= minutes) return true;
  return false;
}

/**
 * Returns "yesterday" as a YYYY-MM-DD string (Dhaka time).
 * Used by the midnight cron job to lock the previous day's records.
 */
export function yesterday(): string {
  const { y, m, d } = getDhakaParts(getNow());
  const yest = new Date(Date.UTC(y, m - 1, d - 1));
  return `${yest.getUTCFullYear()}-${String(yest.getUTCMonth() + 1).padStart(2, "0")}-${String(yest.getUTCDate()).padStart(2, "0")}`;
}

/**
 * Adds days to a YYYY-MM-DD string without applying the server time zone.
 */
export function addDays(dateStr: string, days: number): string {
  const date = parseDateString(dateStr);
  date.setUTCDate(date.getUTCDate() + days);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

/**
 * Returns a human-readable date label, e.g. "May 9" or "Today".
 */
export function formatDateLabel(dateStr: string): string {
  if (dateStr === today()) return "Today";
  const date = parseDateString(dateStr);
  // We format the UTC date as if it were local to avoid timezone shift on display
  return new Intl.DateTimeFormat("en-US", { 
    month: "short", 
    day: "numeric", 
    timeZone: "UTC" 
  }).format(date);
}

/**
 * Converts a YYYY-MM-DD string or Date object to a DD-MM-YYYY string for UI display.
 */
export function formatNumericDate(dateInput: Date | string): string {
  if (typeof dateInput === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
      const [y, m, d] = dateInput.split("-");
      return `${d}-${m}-${y}`;
    }
    dateInput = new Date(dateInput);
  }
  const { y, m, d } = getDhakaParts(dateInput);
  return `${String(d).padStart(2, "0")}-${String(m).padStart(2, "0")}-${y}`;
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
  return days[date.getUTCDay()]!;
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
    cur.setUTCDate(cur.getUTCDate() + 1);
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
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return result;
}

/**
 * Formats a Date object representing UTC midnight (from DB) into a month label (e.g., "November 2024").
 * Safe for both Server and Client Components (avoids hydration mismatch).
 */
export function formatMonthLabel(dateInput: Date | string): string {
  let d = dateInput;
  if (typeof d === "string") {
    if (/^\d{4}-\d{2}$/.test(d)) d += "-01";
    const match = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      d = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    } else {
      d = new Date(d);
    }
  }
  return new Intl.DateTimeFormat("en-US", { 
    month: "long", 
    year: "numeric", 
    timeZone: "UTC" 
  }).format(d);
}

/**
 * Formats a timestamp (e.g. submittedAt) into a human-readable string in Dhaka time.
 * Safe for both Server and Client Components.
 */
export function formatTimestamp(dateInput: Date | string): string {
  const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  return new Intl.DateTimeFormat("en-US", { 
    month: "short", 
    day: "numeric", 
    hour: "2-digit", 
    minute: "2-digit",
    timeZone: "Asia/Dhaka" 
  }).format(d);
}
