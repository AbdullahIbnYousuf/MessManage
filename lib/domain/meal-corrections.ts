export type MealCorrectionDraftChange = {
  date: string;
  mealCount: number;
};

export type ValidMealCorrectionInput = {
  month: string;
  changes: MealCorrectionDraftChange[];
};

export type MealCorrectionValidationResult =
  | { ok: true; value: ValidMealCorrectionInput }
  | { ok: false; error: string };

function isValidDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function validateMealCorrectionInput(
  input: unknown
): MealCorrectionValidationResult {
  if (typeof input !== "object" || input === null) {
    return { ok: false, error: "Invalid request body." };
  }

  const candidate = input as { month?: unknown; changes?: unknown };
  if (
    typeof candidate.month !== "string"
    || !/^\d{4}-(0[1-9]|1[0-2])$/.test(candidate.month)
  ) {
    return { ok: false, error: "Invalid month. Use YYYY-MM." };
  }
  if (!Array.isArray(candidate.changes) || candidate.changes.length === 0) {
    return { ok: false, error: "Add at least one meal correction." };
  }
  if (candidate.changes.length > 31) {
    return { ok: false, error: "A correction request cannot contain more than 31 dates." };
  }

  const seenDates = new Set<string>();
  const changes: MealCorrectionDraftChange[] = [];
  for (const rawChange of candidate.changes) {
    if (typeof rawChange !== "object" || rawChange === null) {
      return { ok: false, error: "Each correction must include a valid date and meal count." };
    }
    const change = rawChange as { date?: unknown; mealCount?: unknown };
    if (
      typeof change.date !== "string"
      || !isValidDateString(change.date)
      || !change.date.startsWith(`${candidate.month}-`)
    ) {
      return { ok: false, error: "Every correction date must belong to the selected month." };
    }
    if (!Number.isInteger(change.mealCount) || (change.mealCount as number) < 0) {
      return { ok: false, error: "Meal counts must be non-negative integers." };
    }
    if (seenDates.has(change.date)) {
      return { ok: false, error: "Each date can appear only once in a correction request." };
    }
    seenDates.add(change.date);
    changes.push({ date: change.date, mealCount: change.mealCount as number });
  }

  changes.sort((left, right) => left.date.localeCompare(right.date));
  return { ok: true, value: { month: candidate.month, changes } };
}

export function mealCorrectionDelta(
  changes: Array<{ originalMealCount: number | null; proposedMealCount: number }>
): number {
  return changes.reduce(
    (total, change) => total + change.proposedMealCount - (change.originalMealCount ?? 0),
    0
  );
}
