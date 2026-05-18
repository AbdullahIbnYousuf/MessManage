// POST /api/bazar/expense — submit a bazar expense (closes the active trip)

import { requireAuth } from "@/lib/session";
import { db } from "@/lib/db";
import { effectiveBazarDate, validateBazarAmount } from "@/lib/domain/bazar";
import { getNow } from "@/lib/utils/dates";
import Decimal from "decimal.js";

export async function POST(request: Request) {
  try {
    const user = await requireAuth();

    const body = await request.json() as {
      amount: number | string;
      note?: string;
      date?: string;
    };

    // Validate amount
    const amountError = validateBazarAmount(body.amount);
    if (amountError) {
      return Response.json({ error: amountError }, { status: 400 });
    }

    const amount = new Decimal(String(body.amount));
    const requestedDate = body.date ?? getNow().toISOString().slice(0, 10);
    const expenseDate = effectiveBazarDate(requestedDate);

    // Get active trip
    const config = await db.systemConfig.findFirst();
    if (!config?.activeTripId) {
      return Response.json({ error: "No active bazar trip found." }, { status: 400 });
    }

    const trip = await db.bazarTrip.findUnique({
      where: { id: config.activeTripId },
    });

    if (!trip || trip.status !== "open") {
      return Response.json({ error: "No active bazar trip found." }, { status: 400 });
    }

    // Submit expense + close trip + clear notes + clear activeTripId — all atomic
    await db.$transaction(async (tx) => {
      await tx.bazarExpense.create({
        data: {
          userId: user.id,
          tripId: trip.id,
          amount,
          note: body.note ?? null,
          date: new Date(expenseDate),
          submittedAt: getNow(),
        },
      });

      await tx.bazarTrip.update({
        where: { id: trip.id },
        data: {
          status: "completed",
          completedAt: getNow(),
          shoppingNotes: null,
        },
      });

      await tx.systemConfig.updateMany({
        data: { activeTripId: null },
      });
    });

    return Response.json({ data: { submitted: true, date: expenseDate, amount: amount.toFixed(2) } }, { status: 201 });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error(err);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
