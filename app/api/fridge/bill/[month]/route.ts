// PATCH /api/fridge/bill/[month] — admin-only correction of a fridge bill.
// Recalculates totalAmount and the original recipients' frozen allocation amounts.
// [month] is YYYY-MM format.
// Rules:
//   - Admin only — this changes every member's debit.
//   - Month must not be settled.

import { requireAdmin } from "@/lib/session";
import { computeFridgeAllocations, computeTotalFromReadings } from "@/lib/domain/fridge";
import Decimal from "decimal.js";
import { withSerializableRetry } from "@/lib/services/debts/transactions";
import { assertMonthOpen } from "@/lib/services/month-state";
import { financialErrorResponse } from "@/lib/utils/financial-api";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ month: string }> }
) {
  try {
    await requireAdmin();
    const { month } = await params;

    // Parse at UTC midnight so local server time cannot shift the month key.
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      return Response.json({ error: "Invalid month format. Use YYYY-MM." }, { status: 400 });
    }
    const monthDate = new Date(`${month}-01`);

    const body = await request.json() as {
      previousReading?: unknown;
      currentReading?: unknown;
      unitPrice?: unknown;
    };

    const result = await withSerializableRetry(async (tx) => {
      const bill = await tx.fridgeBill.findUnique({
        where: { month: monthDate },
        include: { allocations: { select: { userId: true } } },
      });
      if (!bill) {
        throw Response.json({ error: "No fridge bill found for this month." }, { status: 404 });
      }
      await assertMonthOpen(tx, monthDate);

      let previousReading: Decimal;
      let currentReading: Decimal;
      let unitPrice: Decimal;
      try {
        previousReading = body.previousReading !== undefined && body.previousReading !== null && body.previousReading !== ""
          ? new Decimal(String(body.previousReading))
          : new Decimal(bill.previousReading.toString());
        currentReading = body.currentReading !== undefined && body.currentReading !== null && body.currentReading !== ""
          ? new Decimal(String(body.currentReading))
          : new Decimal(bill.currentReading.toString());
        unitPrice = body.unitPrice !== undefined && body.unitPrice !== null && body.unitPrice !== ""
          ? new Decimal(String(body.unitPrice))
          : new Decimal(bill.unitPrice.toString());
      } catch {
        throw Response.json({ error: "Invalid fridge bill values." }, { status: 400 });
      }
      if (unitPrice.lte(0)) {
        throw Response.json({ error: "Invalid unitPrice." }, { status: 400 });
      }
      if (currentReading.lt(previousReading)) {
        throw Response.json(
          { error: "Current reading cannot be less than the previous reading." },
          { status: 400 }
        );
      }
      const computedTotal = computeTotalFromReadings(previousReading, currentReading, unitPrice);
      if (!computedTotal || computedTotal.lte(0)) {
        throw Response.json(
          { error: "Computed bill amount is zero — check your meter readings." },
          { status: 400 }
        );
      }
      if (bill.allocations.length === 0 || bill.allocations.length !== bill.memberCount) {
        throw Response.json(
          { error: "This bill's frozen member allocations are incomplete and it cannot be corrected." },
          { status: 409 }
        );
      }
      const totalAmount = computedTotal.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      const allocations = computeFridgeAllocations(
        totalAmount,
        bill.allocations.map((allocation) => allocation.userId)
      );
      const updatedBill = await tx.fridgeBill.update({
        where: { month: monthDate },
        data: { previousReading, currentReading, unitPrice, totalAmount },
      });

      await Promise.all(allocations.map((allocation) =>
        tx.fridgeAllocation.update({
          where: {
            billId_userId: { billId: bill.id, userId: allocation.userId },
          },
          data: { amount: allocation.amount },
        })
      ));

      return { updated: updatedBill, allocations };
    });

    const allocationAmounts = result.allocations.map((allocation) => allocation.amount);
    const { updated } = result;

    return Response.json({
      data: {
        id: updated.id,
        month: month,
        previousReading: updated.previousReading.toFixed(2),
        currentReading: updated.currentReading.toFixed(2),
        unitPrice: updated.unitPrice.toFixed(4),
        totalAmount: updated.totalAmount.toFixed(2),
        memberCount: updated.memberCount,
        shareRange: {
          min: Decimal.min(...allocationAmounts).toFixed(2),
          max: Decimal.max(...allocationAmounts).toFixed(2),
        },
      },
    });
  } catch (err) {
    if (err instanceof Response) return err;
    return financialErrorResponse(err, "Fridge bill correction");
  }
}
