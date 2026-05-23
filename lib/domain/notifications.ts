import { addDays, getDhakaParts, toDateString } from "@/lib/utils/dates";

export type MealReminderType = "previous_night" | "deadline_morning";

export type DueMealReminder = {
  type: MealReminderType;
  mealDate: string;
};

const PREVIOUS_NIGHT_REMINDER_MINUTE = 21 * 60;
const DEADLINE_REMINDER_OFFSET_MINUTES = 30;

function parseTimeToMinutes(time: string): number | null {
  const match = time.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;

  return hours * 60 + minutes;
}

function isWithinWindow(
  currentMinute: number,
  targetMinute: number,
  windowMinutes: number
): boolean {
  const normalizedTarget = ((targetMinute % 1440) + 1440) % 1440;
  const elapsed = (currentMinute - normalizedTarget + 1440) % 1440;
  return elapsed >= 0 && elapsed < windowMinutes;
}

export function getDueMealReminders(
  now: Date,
  mealDeadline: string,
  windowMinutes = 15
): DueMealReminder[] {
  const deadlineMinute = parseTimeToMinutes(mealDeadline);
  if (deadlineMinute === null) return [];

  const dhaka = getDhakaParts(now);
  const currentMinute = dhaka.h * 60 + dhaka.min;
  const today = toDateString(now);
  const reminders: DueMealReminder[] = [];

  if (
    isWithinWindow(
      currentMinute,
      PREVIOUS_NIGHT_REMINDER_MINUTE,
      windowMinutes
    )
  ) {
    reminders.push({ type: "previous_night", mealDate: addDays(today, 1) });
  }

  if (
    isWithinWindow(
      currentMinute,
      deadlineMinute - DEADLINE_REMINDER_OFFSET_MINUTES,
      windowMinutes
    )
  ) {
    reminders.push({ type: "deadline_morning", mealDate: today });
  }

  return reminders;
}

export function formatMealReminderTitle(type: MealReminderType): string {
  if (type === "previous_night") return "Set tomorrow's meals";
  return "Meal deadline soon";
}

export function formatMealReminderBody(
  type: MealReminderType,
  deadline: string
): string {
  if (type === "previous_night") {
    return `Tap to set tomorrow's meals before the ${deadline} deadline.`;
  }

  return `Tap to confirm today's meals. Deadline is in 30 minutes at ${deadline}.`;
}
