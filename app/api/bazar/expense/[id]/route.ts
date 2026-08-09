// PATCH /api/bazar/expense/[id] — edit a bazar expense
// Rules:
//   - Submitter (the user who submitted) can edit only on the same calendar day as submittedAt (before midnight).
//   - Admin can edit any expense as long as the month is not settled.
//   - Editable fields: amount, note, date (within current month).

import { requireAuth } from "@/lib/session";
import { db } from "@/lib/db";
import { effectiveBazarDate, validateBazarAmount } from "@/lib/domain/bazar";
import { getNow, toDateString, getDhakaParts, firstDayOfMonth } from "@/lib/utils/dates";
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

    const expense = await db.bazarExpense.findUnique({ where: { id } });
    if (!expense) {
      return Response.json({ error: "Expense not found." }, { status: 404 });
    }

    const isAdmin = user.role === "admin";
    const isOwner = expense.userId === user.id;

    if (!isAdmin && !isOwner) {
      return Response.json({ error: "You can only edit your own expenses." }, { status: 403 });
    }

    const now = getNow();
    const todayStr = toDateString(now);
    const submittedDateStr = toDateString(new Date(expense.submittedAt));

    // Submitter rule: same calendar day only
    if (!isAdmin && submittedDateStr !== todayStr) {
      return Response.json(
        { error: "You can only edit this expense on the day it was submitted." },
        { status: 403 }
      );
    }

    const body = await request.json() as {
      amount?: number | string;
      note?: string | null;
      date?: string;
    };

    // Validate amount if provided
    let amount: Decimal | undefined;
    if (body.amount !== undefined) {
      const amountError = validateBazarAmount(body.amount);
      if (amountError) {
        return Response.json({ error: amountError }, { status: 400 });
      }
      amount = new Decimal(String(body.amount));
    }

    // Validate date if provided
    let expenseDate: string | undefined;
    if (body.date !== undefined) {
      expenseDate = effectiveBazarDate(body.date);
    }

    const updated = await withSerializableRetry(async (tx) => {
      const current = await tx.bazarExpense.findUnique({ where: { id } });
      if (!current) return null;
      const currentParts = getDhakaParts(current.date);
      await assertMonthOpen(tx, firstDayOfMonth(currentParts.y, currentParts.m));
      if (expenseDate !== undefined) {
        const nextParts = getDhakaParts(new Date(expenseDate));
        await assertMonthOpen(tx, firstDayOfMonth(nextParts.y, nextParts.m));
      }
      return tx.bazarExpense.update({
        where: { id },
        data: {
          ...(amount !== undefined && { amount }),
          ...(body.note !== undefined && { note: body.note?.trim() || null }),
          ...(expenseDate !== undefined && { date: new Date(expenseDate) }),
        },
      });
    });
    if (!updated) {
      return Response.json({ error: "Expense not found." }, { status: 404 });
    }

    return Response.json({
      data: {
        id: updated.id,
        amount: updated.amount.toFixed(2),
        note: updated.note,
        date: toDateString(updated.date),
      },
    });
  } catch (err) {
    if (err instanceof Response) return err;
    return financialErrorResponse(err, "Bazar expense update");
  }
}
