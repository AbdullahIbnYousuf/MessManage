import { describe, expect, it } from "vitest";
import {
  mealCorrectionDelta,
  validateMealCorrectionInput,
} from "@/lib/domain/meal-corrections";

describe("meal correction validation", () => {
  it("accepts and chronologically sorts exact changes for one month", () => {
    expect(validateMealCorrectionInput({
      month: "2026-08",
      changes: [
        { date: "2026-08-31", mealCount: 0 },
        { date: "2026-08-01", mealCount: 2 },
      ],
    })).toEqual({
      ok: true,
      value: {
        month: "2026-08",
        changes: [
          { date: "2026-08-01", mealCount: 2 },
          { date: "2026-08-31", mealCount: 0 },
        ],
      },
    });
  });

  it("rejects invalid dates, duplicate dates, and invalid counts", () => {
    expect(validateMealCorrectionInput({
      month: "2026-02",
      changes: [{ date: "2026-02-30", mealCount: 1 }],
    })).toMatchObject({ ok: false });
    expect(validateMealCorrectionInput({
      month: "2026-08",
      changes: [
        { date: "2026-08-01", mealCount: 1 },
        { date: "2026-08-01", mealCount: 2 },
      ],
    })).toMatchObject({ ok: false });
    expect(validateMealCorrectionInput({
      month: "2026-08",
      changes: [{ date: "2026-08-01", mealCount: 1.5 }],
    })).toMatchObject({ ok: false });
  });

  it("calculates the complete batch meal delta, including missing originals", () => {
    expect(mealCorrectionDelta([
      { originalMealCount: 2, proposedMealCount: 1 },
      { originalMealCount: 0, proposedMealCount: 3 },
      { originalMealCount: null, proposedMealCount: 2 },
    ])).toBe(4);
  });
});
