// GET  /api/meals/pattern — get current user's meal pattern
// PUT  /api/meals/pattern — update pattern and propagate to future meal records

import { requireAuth } from "@/lib/session";
import { db } from "@/lib/db";
import { futureDatesInCurrentMonth, applyPatternToDate } from "@/lib/domain/meal";
import type { MealPattern } from "@/types";

export async function GET() {
  try {
    const user = await requireAuth();

    const pattern = await db.mealPattern.findUnique({
      where: { userId: user.id },
    });

    if (!pattern) {
      // Return zeros if somehow no pattern exists yet
      return Response.json({
        data: {
          monday: 0, tuesday: 0, wednesday: 0, thursday: 0,
          friday: 0, saturday: 0, sunday: 0,
        },
      });
    }

    return Response.json({ data: pattern });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error(err);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireAuth();
    const body = await request.json() as Partial<MealPattern>;

    // Validate all values are non-negative integers
    const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
    const data: MealPattern = { monday: 0, tuesday: 0, wednesday: 0, thursday: 0, friday: 0, saturday: 0, sunday: 0 };

    for (const day of days) {
      const val = body[day];
      if (val === undefined || !Number.isInteger(val) || val < 0) {
        return Response.json({ error: `Invalid value for ${day}. Must be a non-negative integer.` }, { status: 400 });
      }
      data[day] = val;
    }

    // Update pattern
    await db.mealPattern.upsert({
      where: { userId: user.id },
      update: { ...data },
      create: { userId: user.id, ...data },
    });

    // Propagate to future unlocked meal records in the current month
    const futureDates = futureDatesInCurrentMonth();

    await db.$transaction(
      futureDates.map((dateStr) => {
        const newCount = applyPatternToDate(data, dateStr);
        return db.mealRecord.updateMany({
          where: { userId: user.id, date: new Date(dateStr), isLocked: false },
          data: { mealCount: newCount },
        });
      })
    );

    return Response.json({ data: { updated: true } });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error(err);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
