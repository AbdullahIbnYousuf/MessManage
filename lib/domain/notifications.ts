import { getDhakaParts, toDateString } from "@/lib/utils/dates";

export type MealReminderType = "deadline_morning";

export type DueMealReminder = {
  type: MealReminderType;
  mealDate: string;
};

/**
 * How many minutes before the deadline to send the reminder.
 * Scheduled at 90 min before on Vercel; Hobby plan can be up to 59 min late,
 * so the earliest the cron fires is ~30 min before deadline.
 */
const DEADLINE_REMINDER_OFFSET_MINUTES = 90;

/**
 * Window to accept the reminder as "due".
 * Must be wide enough to cover Vercel Hobby's ±59 min scheduling imprecision.
 */
const WINDOW_MINUTES = 90;

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

/**
 * Returns a DueMealReminder if the cron is running within the expected window
 * before the meal deadline. The NotificationDelivery unique constraint ensures
 * only one notification is ever sent per user per day even if the cron fires
 * multiple times (it won't on Hobby, but is safe regardless).
 */
export function getDueMealReminders(
  now: Date,
  mealDeadline: string
): DueMealReminder[] {
  const deadlineMinute = parseTimeToMinutes(mealDeadline);
  if (deadlineMinute === null) return [];

  const dhaka = getDhakaParts(now);
  const currentMinute = dhaka.h * 60 + dhaka.min;
  const today = toDateString(now);

  if (
    isWithinWindow(
      currentMinute,
      deadlineMinute - DEADLINE_REMINDER_OFFSET_MINUTES,
      WINDOW_MINUTES
    )
  ) {
    return [{ type: "deadline_morning", mealDate: today }];
  }

  return [];
}

export function formatMealReminderTitle(): string {
  return "Meal deadline approaching";
}

export function formatMealReminderBody(deadline: string): string {
  return `Tap to confirm today's meals before the ${deadline} deadline.`;
}
