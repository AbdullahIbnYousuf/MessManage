// GET/POST /api/meals/edit-request — review and submit exact meal corrections

import { validateMealCorrectionInput } from "@/lib/domain/meal-corrections";
import { requireAuth } from "@/lib/session";
import {
  fetchMealCorrectionContext,
  MealCorrectionError,
  submitMealCorrectionBatch,
} from "@/lib/services/meal-corrections";
import { currentMonthKey } from "@/lib/utils/dates";

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid request body." }, { status: 400 });
    }
    const validation = validateMealCorrectionInput(body);
    if (!validation.ok) {
      return Response.json({ error: validation.error }, { status: 400 });
    }

    const batch = await submitMealCorrectionBatch({
      userId: user.id,
      ...validation.value,
    });
    return Response.json({ data: batch }, { status: 201 });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof MealCorrectionError) {
      return Response.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    console.error("Meal correction submission failed.", error);
    return Response.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    const month = new URL(request.url).searchParams.get("month")
      ?? currentMonthKey().slice(0, 7);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      return Response.json({ error: "Invalid month. Use YYYY-MM." }, { status: 400 });
    }
    const context = await fetchMealCorrectionContext(user.id, month);
    return Response.json({ data: context });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Meal correction status failed.", error);
    return Response.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
