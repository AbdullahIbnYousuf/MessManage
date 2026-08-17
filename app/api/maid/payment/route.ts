// POST /api/maid/payment — record a maid payment made on behalf of the group

import { requireAuth } from "@/lib/session";
import { db } from "@/lib/db";
import {
  maidServiceMonthForAccountingMonth,
  usesDeferredMaidAccounting,
  validateMaidPayment,
} from "@/lib/domain/maid";
import { currentMonthKey } from "@/lib/utils/dates";
import Decimal from "decimal.js";
import { withSerializableRetry } from "@/lib/services/debts/transactions";
import { assertMonthOpen } from "@/lib/services/month-state";
import { financialErrorResponse } from "@/lib/utils/financial-api";

export async function GET() {
  try {
    await requireAuth();

    // Return all payments, most recent first
    const payments = await db.maidPayment.findMany({
      include: {
        paidBy: { select: { id: true, name: true, nickname: true, avatarUrl: true } },
      },
      orderBy: { paidAt: "desc" },
      take: 30,
    });

    return Response.json({
      data: payments.map((p) => ({
        id: p.id,
        amount: p.amount.toFixed(2),
        month: p.month.toISOString().slice(0, 7),
        note: p.note,
        paidAt: p.paidAt.toISOString(),
        paidBy: { ...p.paidBy, name: p.paidBy.nickname || p.paidBy.name },
      })),
    });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error(err);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth();

    const body = await request.json() as {
      amount: number | string;
      note?: string;
      month?: string; // YYYY-MM-DD, defaults to current month
    };

    const amountError = validateMaidPayment(body.amount);
    if (amountError) {
      return Response.json({ error: amountError }, { status: 400 });
    }

    const monthStr = body.month ?? currentMonthKey();
    if (!/^\d{4}-(0[1-9]|1[0-2])(?:-01)?$/.test(monthStr)) {
      return Response.json({ error: "Invalid month format. Use YYYY-MM." }, { status: 400 });
    }
    const monthDate = new Date(`${monthStr.slice(0, 7)}-01`);
    if (!usesDeferredMaidAccounting(monthDate)) {
      return Response.json(
        { error: "Maid payments before August 2026 use the closed legacy accounting period." },
        { status: 400 }
      );
    }
    const serviceMonth = maidServiceMonthForAccountingMonth(monthDate);

    const payment = await withSerializableRetry(async (tx) => {
      await assertMonthOpen(tx, monthDate);
      return tx.maidPayment.create({
        data: {
          paidById: user.id,
          amount: new Decimal(String(body.amount)),
          month: monthDate,
          serviceMonth,
          note: body.note?.trim() || null,
          paidAt: new Date(),
        },
      });
    });

    return Response.json({
      data: {
        id: payment.id,
        amount: payment.amount.toFixed(2),
        month: payment.month.toISOString().slice(0, 7),
        paidAt: payment.paidAt.toISOString(),
      },
    }, { status: 201 });
  } catch (err) {
    if (err instanceof Response) return err;
    return financialErrorResponse(err, "Maid payment creation");
  }
}
