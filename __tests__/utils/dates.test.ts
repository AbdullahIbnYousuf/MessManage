import { describe, expect, it } from "vitest";
import {
  compareCalendarMonths,
  isDeadlinePassed,
  shiftCalendarMonth,
} from "@/lib/utils/dates";

describe("calendar month helpers", () => {
  it("rolls December into January", () => {
    expect(shiftCalendarMonth(2026, 12, 1)).toEqual({
      year: 2027,
      month: 1,
    });
  });

  it("rolls January back into December", () => {
    expect(shiftCalendarMonth(2026, 1, -1)).toEqual({
      year: 2025,
      month: 12,
    });
  });

  it("orders calendar months across year boundaries", () => {
    expect(
      compareCalendarMonths(
        { year: 2026, month: 12 },
        { year: 2027, month: 1 }
      )
    ).toBeLessThan(0);
  });

  it("treats the exact Dhaka deadline as passed", () => {
    expect(
      isDeadlinePassed("22:00", new Date("2026-08-17T16:00:00.000Z"))
    ).toBe(true);
  });
});
