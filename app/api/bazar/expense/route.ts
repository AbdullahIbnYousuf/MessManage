// POST /api/bazar/expense — submit a bazar expense (closes the active trip)

import { requireAuth } from "@/lib/session";
import { effectiveBazarDate, validateBazarAmount } from "@/lib/domain/bazar";
import { firstDayOfMonth, getDhakaParts, getNow } from "@/lib/utils/dates";
import Decimal from "decimal.js";
import { Prisma } from "@prisma/client";
import { withSerializableRetry } from "@/lib/services/debts/transactions";
import { assertMonthOpen } from "@/lib/services/month-state";
import { FinancialError } from "@/lib/domain/financial-errors";
import { financialErrorResponse } from "@/lib/utils/financial-api";

export async function POST(request: Request) {
  try {
    const user = await requireAuth();

    const body = await request.json() as {
      amount: number | string;
      note?: string;
      date?: string;
      isInstant?: boolean;
    };

    // Validate amount
    const amountError = validateBazarAmount(body.amount);
    if (amountError) {
      return Response.json({ error: amountError }, { status: 400 });
    }

    const amount = new Decimal(String(body.amount));
    const requestedDate = body.date ?? getNow().toISOString().slice(0, 10);
    const expenseDate = effectiveBazarDate(requestedDate);

    const { y, m } = getDhakaParts(new Date(expenseDate));
    const expenseMonth = firstDayOfMonth(y, m);
    const now = getNow();

    try {
      await withSerializableRetry(async (tx) => {
        const config = await tx.systemConfig.findFirst({
          select: { activeTripId: true },
        });
        if (!config?.activeTripId) {
          throw new FinancialError(
            "BAZAR_TRIP_ALREADY_COMPLETED",
            "This bazar trip has already been completed."
          );
        }
        const trip = await tx.bazarTrip.findUnique({
          where: { id: config.activeTripId },
        });
        if (!trip || trip.status !== "open") {
          throw new FinancialError(
            "BAZAR_TRIP_ALREADY_COMPLETED",
            "This bazar trip has already been completed."
          );
        }
        await assertMonthOpen(tx, expenseMonth);
        const closed = await tx.bazarTrip.updateMany({
          where: { id: trip.id, status: "open" },
          data: {
            status: "completed",
            completedAt: now,
            shoppingNotes: null,
          },
        });
        if (closed.count !== 1) {
          throw new FinancialError(
            "BAZAR_TRIP_ALREADY_COMPLETED",
            "This bazar trip has already been completed."
          );
        }

      await tx.bazarExpense.create({
        data: {
          userId: user.id,
          tripId: trip.id,
          amount,
          tripWeight: body.isInstant ? 0.1 : 1.0,
          note: body.note ?? null,
          date: new Date(expenseDate),
          submittedAt: now,
        },
      });
      await tx.systemConfig.updateMany({
        where: { activeTripId: trip.id },
        data: { activeTripId: null },
      });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError
        && error.code === "P2002"
      ) {
        throw new FinancialError(
          "BAZAR_TRIP_ALREADY_COMPLETED",
          "This bazar trip has already been completed."
        );
      }
      throw error;
    }

    return Response.json({ data: { submitted: true, date: expenseDate, amount: amount.toFixed(2) } }, { status: 201 });
  } catch (err) {
    if (err instanceof Response) return err;
    return financialErrorResponse(err, "Bazar expense creation");
  }
}
