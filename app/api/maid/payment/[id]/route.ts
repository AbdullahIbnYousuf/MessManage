// PATCH /api/maid/payment/[id] — edit a maid payment
// Rules:
//   - Submitter can edit only on the same calendar day as paidAt (before midnight).
//   - Admin can edit any payment as long as the month is not settled.
//   - Editable fields: amount, note.

import { requireAuth } from "@/lib/session";
import { db } from "@/lib/db";
import { validateMaidPayment } from "@/lib/domain/maid";
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

    const payment = await db.maidPayment.findUnique({ where: { id } });
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

    const body = await request.json() as {
      amount?: number | string;
      note?: string | null;
    };

    let amount: Decimal | undefined;
    if (body.amount !== undefined) {
      const amountError = validateMaidPayment(body.amount);
      if (amountError) {
        return Response.json({ error: amountError }, { status: 400 });
      }
      amount = new Decimal(String(body.amount));
    }

    const updated = await withSerializableRetry(async (tx) => {
      const current = await tx.maidPayment.findUnique({ where: { id } });
      if (!current) {
        return null;
      }
      await assertMonthOpen(tx, current.month);
      return tx.maidPayment.update({
        where: { id },
        data: {
          ...(amount !== undefined && { amount }),
          ...(body.note !== undefined && { note: body.note?.trim() || null }),
        },
      });
    });
    if (!updated) {
      return Response.json({ error: "Payment not found." }, { status: 404 });
    }

    return Response.json({
      data: {
        id: updated.id,
        amount: updated.amount.toFixed(2),
        note: updated.note,
        month: updated.month.toISOString().slice(0, 7),
      },
    });
  } catch (err) {
    if (err instanceof Response) return err;
    return financialErrorResponse(err, "Maid payment update");
  }
}
