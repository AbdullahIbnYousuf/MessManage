// POST /api/fridge/payment — record that someone paid the fridge bill upfront.
// The payer gets the full amount credited. All members already carry their
// frozen FridgeAllocation debit from the FridgeBill.

import { requireAuth } from "@/lib/session";
import { previousMonthKey } from "@/lib/utils/dates";
import Decimal from "decimal.js";
import { withSerializableRetry } from "@/lib/services/debts/transactions";
import { assertMonthOpen } from "@/lib/services/month-state";
import { financialErrorResponse } from "@/lib/utils/financial-api";

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
    if (!/^\d{4}-(0[1-9]|1[0-2])(?:-01)?$/.test(monthStr)) {
      return Response.json({ error: "Invalid month format. Use YYYY-MM." }, { status: 400 });
    }
    const monthDate = new Date(`${monthStr.slice(0, 7)}-01`);

    const payment = await withSerializableRetry(async (tx) => {
      const bill = await tx.fridgeBill.findUnique({ where: { month: monthDate } });
      if (!bill) {
        throw Response.json({ error: "No fridge bill found for this month." }, { status: 404 });
      }
      await assertMonthOpen(tx, bill.month);
      return tx.fridgePayment.create({
        data: {
          billId: bill.id,
          paidById: user.id,
          amount,
          paidAt: new Date(),
        },
      });
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
    return financialErrorResponse(err, "Fridge payment creation");
  }
}
