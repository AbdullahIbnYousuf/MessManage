// POST /api/fridge/payment — record that someone paid the fridge bill upfront.
// The payer gets the full amount credited. All members already carry their
// per_member_amount debit from the FridgeBill.

import { requireAuth } from "@/lib/session";
import { db } from "@/lib/db";
import Decimal from "decimal.js";

export async function POST(request: Request) {
  try {
    const user = await requireAuth();

    const body = await request.json() as { billId: unknown; amount: unknown };

    if (!body.billId || typeof body.billId !== "string") {
      return Response.json({ error: "billId is required." }, { status: 400 });
    }

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

    const bill = await db.fridgeBill.findUnique({ where: { id: body.billId } });
    if (!bill) {
      return Response.json({ error: "Fridge bill not found." }, { status: 404 });
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
