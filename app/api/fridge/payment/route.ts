// POST /api/fridge/payment — record that someone paid the fridge bill upfront.
// The payer gets the full amount credited. All members already carry their
// frozen FridgeAllocation debit from the FridgeBill.

import { requireAuth } from "@/lib/session";
import { db } from "@/lib/db";
import { previousMonthKey } from "@/lib/utils/dates";
import Decimal from "decimal.js";

export async function POST(request: Request) {
  try {
    const user = await requireAuth();

    const body = await request.json() as { amount: unknown; month?: string };

    const raw = body.amount;
    if (raw === undefined || raw === null || raw === "") {
      return Response.json({ error: "amount is required." }, { status: 400 });
    }

    let amount: Decimal;
    try {
      amount = new Decimal(String(raw));
    } catch {
      return Response.json({ error: "Invalid amount." }, { status: 400 });
    }

    if (amount.lte(0)) {
      return Response.json({ error: "amount must be greater than zero." }, { status: 400 });
    }

    // Resolve the bill by month (defaults to previous month)
    const monthStr = body.month ?? previousMonthKey();
    const monthDate = new Date(monthStr);

    const bill = await db.fridgeBill.findUnique({ where: { month: monthDate } });
    if (!bill) {
      return Response.json({ error: "No fridge bill found for this month." }, { status: 404 });
    }

    // Block payment if this bill's month has already been settled
    const settled = await db.monthlySettlement.findFirst({
      where: { month: bill.month },
      select: { id: true },
    });
    if (settled) {
      return Response.json(
        { error: "This month has already been settled. Payments can no longer be recorded." },
        { status: 400 }
      );
    }

    const payment = await db.fridgePayment.create({
      data: {
        billId: bill.id,
        paidById: user.id,
        amount,
        paidAt: new Date(),
      },
    });

    return Response.json({
      data: {
        id: payment.id,
        billId: payment.billId,
        amount: payment.amount.toFixed(2),
        paidAt: payment.paidAt.toISOString(),
      },
    }, { status: 201 });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error(err);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
