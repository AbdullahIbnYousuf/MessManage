import { describe, expect, it } from "vitest";
import { getDueMealReminders } from "@/lib/domain/notifications";

describe("meal notification reminders", () => {
  it("returns the previous-night reminder at 9 PM Dhaka time", () => {
    const reminders = getDueMealReminders(
      new Date("2026-05-23T15:01:00.000Z"),
      "08:30"
    );

    expect(reminders).toEqual([
      { type: "previous_night", mealDate: "2026-05-24" },
    ]);
  });

  it("returns the morning reminder 30 minutes before the meal deadline", () => {
    const reminders = getDueMealReminders(
      new Date("2026-05-23T02:00:00.000Z"),
      "08:30"
    );

    expect(reminders).toEqual([
      { type: "deadline_morning", mealDate: "2026-05-23" },
    ]);
  });

  it("does not return reminders outside the configured window", () => {
    const reminders = getDueMealReminders(
      new Date("2026-05-23T03:00:00.000Z"),
      "08:30"
    );

    expect(reminders).toEqual([]);
  });
});
