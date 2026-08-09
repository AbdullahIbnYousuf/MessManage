// POST /api/maid/payment — record a maid payment made on behalf of the group

import { requireAuth } from "@/lib/session";
import { db } from "@/lib/db";
import { validateMaidPayment } from "@/lib/domain/maid";
import { currentMonthKey } from "@/lib/utils/dates";
import Decimal from "decimal.js";

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
    const monthDate = new Date(monthStr);

    const payment = await db.maidPayment.create({
      data: {
        paidById: user.id,
        amount: new Decimal(String(body.amount)),
        month: monthDate,
        note: body.note?.trim() || null,
        paidAt: new Date(),
      },
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
    console.error(err);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
