// PATCH /api/fridge/payment/[id] — edit a fridge payment
// Rules:
//   - Submitter can edit only on the same calendar day as paidAt (before midnight).
//   - Admin can edit any payment as long as the linked bill's month is not settled.
//   - Editable field: amount.

import { requireAuth } from "@/lib/session";
import { db } from "@/lib/db";
import { getNow, toDateString } from "@/lib/utils/dates";
import Decimal from "decimal.js";
import { withSerializableRetry } from "@/lib/services/debts/transactions";
import { assertMonthOpen } from "@/lib/services/month-state";
import { financialErrorResponse } from "@/lib/utils/financial-api";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const payment = await db.fridgePayment.findUnique({
      where: { id },
      include: { bill: { select: { month: true } } },
    });
    if (!payment) {
      return Response.json({ error: "Payment not found." }, { status: 404 });
    }

    const isAdmin = user.role === "admin";
    const isOwner = payment.paidById === user.id;

    if (!isAdmin && !isOwner) {
      return Response.json({ error: "You can only edit your own payments." }, { status: 403 });
    }

    const now = getNow();
    const todayStr = toDateString(now);
    const paidDateStr = toDateString(new Date(payment.paidAt));

    // Submitter rule: same calendar day only
    if (!isAdmin && paidDateStr !== todayStr) {
      return Response.json(
        { error: "You can only edit this payment on the day it was submitted." },
        { status: 403 }
      );
    }

    const body = await request.json() as { amount?: unknown };

    let amount: Decimal | undefined;
    if (body.amount !== undefined) {
      try {
        amount = new Decimal(String(body.amount));
      } catch {
        return Response.json({ error: "Invalid amount." }, { status: 400 });
      }
      if (amount.lte(0)) {
        return Response.json({ error: "amount must be greater than zero." }, { status: 400 });
      }
    }

    if (amount === undefined) {
      return Response.json({ error: "Nothing to update." }, { status: 400 });
    }

    const updated = await withSerializableRetry(async (tx) => {
      const current = await tx.fridgePayment.findUnique({
        where: { id },
        include: { bill: { select: { month: true } } },
      });
      if (!current) return null;
      await assertMonthOpen(tx, current.bill.month);
      return tx.fridgePayment.update({
        where: { id },
        data: { amount },
      });
    });
    if (!updated) {
      return Response.json({ error: "Payment not found." }, { status: 404 });
    }

    return Response.json({
      data: {
        id: updated.id,
        amount: updated.amount.toFixed(2),
        paidAt: updated.paidAt.toISOString(),
      },
    });
  } catch (err) {
    if (err instanceof Response) return err;
    return financialErrorResponse(err, "Fridge payment update");
  }
}
