// PATCH /api/fridge/payment/[id] — edit a fridge payment
// Rules:
//   - Submitter can edit only on the same calendar day as paidAt (before midnight).
//   - Admin can edit any payment as long as the linked bill's month is not settled.
//   - Editable field: amount.

import { requireAuth } from "@/lib/session";
import { db } from "@/lib/db";
import { getNow, toDateString } from "@/lib/utils/dates";
import Decimal from "decimal.js";

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

    // Admin rule: bill's month must not be settled
    if (isAdmin) {
      const settled = await db.monthlySettlement.findFirst({
        where: { month: payment.bill.month },
        select: { id: true },
      });
      if (settled) {
        return Response.json(
          { error: "This month has already been settled. The payment cannot be edited." },
          { status: 400 }
        );
      }
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

    const updated = await db.fridgePayment.update({
      where: { id },
      data: { amount },
    });

    return Response.json({
      data: {
        id: updated.id,
        amount: updated.amount.toFixed(2),
        paidAt: updated.paidAt.toISOString(),
      },
    });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error(err);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
