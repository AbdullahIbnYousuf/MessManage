import { describe, expect, it } from "vitest";
import { getDueMealReminders } from "@/lib/domain/notifications";

// Deadline: 22:00 Dhaka (UTC+6) = 16:00 UTC
// Reminder fires 90 min before = 20:30 Dhaka = 14:30 UTC
// Window is 90 min wide: 14:30–16:00 UTC = 20:30–22:00 Dhaka

describe("meal notification reminders", () => {
  it("returns the deadline reminder when cron fires exactly 90 min before deadline", () => {
    // 14:30 UTC = 20:30 Dhaka, exactly 90 min before 22:00
    const reminders = getDueMealReminders(
      new Date("2026-05-23T14:30:00.000Z"),
      "22:00"
    );

    expect(reminders).toEqual([
      { type: "deadline_morning", mealDate: "2026-05-23" },
    ]);
  });

  it("still fires when Vercel delivers the cron up to 59 min late (worst case ~31 min before deadline)", () => {
    // 15:29 UTC = 21:29 Dhaka — still within the 90-min window
    const reminders = getDueMealReminders(
      new Date("2026-05-23T15:29:00.000Z"),
      "22:00"
    );

    expect(reminders).toEqual([
      { type: "deadline_morning", mealDate: "2026-05-23" },
    ]);
  });

  it("does not fire outside the window", () => {
    // 17:00 UTC = 23:00 Dhaka — deadline has already passed
    const reminders = getDueMealReminders(
      new Date("2026-05-23T17:00:00.000Z"),
      "22:00"
    );

    expect(reminders).toEqual([]);
  });

  it("does not fire in the middle of the night", () => {
    // 06:00 UTC = 12:00 Dhaka — nowhere near deadline
    const reminders = getDueMealReminders(
      new Date("2026-05-23T06:00:00.000Z"),
      "22:00"
    );

    expect(reminders).toEqual([]);
  });
});
