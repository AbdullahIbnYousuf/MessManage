// Date helpers — month boundaries, deadline checks, formatting.
// All dates are handled as plain strings (YYYY-MM-DD) or Date objects.
// No timezone magic — the app operates in a single household timezone.

/** Returns today as YYYY-MM-DD */
export function getToday(): string {
  const now = new Date();
  return formatDate(now);
}

/** Returns the first day of the current month as YYYY-MM-DD */
export function getCurrentMonthStart(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

/** Returns the first day of a given month as YYYY-MM-DD */
export function getMonthStart(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

/** Returns the last day of a given month as YYYY-MM-DD */
export function getMonthEnd(year: number, month: number): string {
  const lastDay = new Date(year, month, 0).getDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
}

/** Returns all YYYY-MM-DD date strings in a given month */
export function getDatesInMonth(year: number, month: number): string[] {
  const dates: string[] = [];
  const daysInMonth = new Date(year, month, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    dates.push(
      `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`
    );
  }
  return dates;
}

/** Formats a Date object as YYYY-MM-DD */
export function formatDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Returns the day-of-week key (monday, tuesday, ...) for a YYYY-MM-DD string */
export function getDayOfWeek(
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
  const d = new Date(dateStr + "T00:00:00");
  return days[d.getDay()]!;
}

/** Returns true if the daily deadline time has already passed today */
export function isDeadlinePassed(deadlineTime: string): boolean {
  const now = new Date();
  const [hours, minutes] = deadlineTime.split(":").map(Number);
  const deadline = new Date(now);
  deadline.setHours(hours!, minutes!, 0, 0);
  return now >= deadline;
}

/** Returns true if dateStr is before today */
export function isPastDate(dateStr: string): boolean {
  return dateStr < getToday();
}

/** Returns true if dateStr is today */
export function isToday(dateStr: string): boolean {
  return dateStr === getToday();
}

/** Returns true if dateStr is in a prior calendar month relative to today */
export function isPriorMonth(dateStr: string): boolean {
  const today = getToday();
  const currentMonthStart = getCurrentMonthStart();
  return dateStr < currentMonthStart && dateStr < today;
}

/** Formats a month string (YYYY-MM-DD) for display e.g. "November 2024" */
export function formatMonthDisplay(monthStr: string): string {
  const d = new Date(monthStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}
