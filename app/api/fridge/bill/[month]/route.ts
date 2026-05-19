// PATCH /api/fridge/bill/[month] — admin-only correction of a fridge bill.
// Recalculates totalAmount and perMemberAmount when readings or unitPrice change.
// [month] is YYYY-MM format.
// Rules:
//   - Admin only — this changes every member's debit.
//   - Month must not be settled.

import { requireAdmin } from "@/lib/session";
import { db } from "@/lib/db";
import { computePerMemberAmount, computeTotalFromReadings } from "@/lib/domain/fridge";
import Decimal from "decimal.js";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ month: string }> }
) {
  try {
    await requireAdmin();
    const { month } = await params;

    // month param is YYYY-MM — convert to first-of-month Date
    const monthDate = new Date(month + "-01T00:00:00");
    if (isNaN(monthDate.getTime())) {
      return Response.json({ error: "Invalid month format. Use YYYY-MM." }, { status: 400 });
    }

    const bill = await db.fridgeBill.findUnique({ where: { month: monthDate } });
    if (!bill) {
      return Response.json({ error: "No fridge bill found for this month." }, { status: 404 });
    }

    // Block edit if already settled
    const settled = await db.monthlySettlement.findFirst({
      where: { month: monthDate },
      select: { id: true },
    });
    if (settled) {
      return Response.json(
        { error: "This month has already been settled. The bill cannot be corrected." },
        { status: 400 }
      );
    }

    const body = await request.json() as {
      previousReading?: unknown;
      currentReading?: unknown;
      unitPrice?: unknown;
    };

    // Resolve readings — fall back to existing values if not provided
    let previousReading: Decimal;
    let currentReading: Decimal;
    let unitPrice: Decimal;

    try {
      previousReading = body.previousReading !== undefined && body.previousReading !== null && body.previousReading !== ""
        ? new Decimal(String(body.previousReading))
        : new Decimal(bill.previousReading.toString());
    } catch {
      return Response.json({ error: "Invalid previousReading." }, { status: 400 });
    }

    try {
      currentReading = body.currentReading !== undefined && body.currentReading !== null && body.currentReading !== ""
        ? new Decimal(String(body.currentReading))
        : new Decimal(bill.currentReading.toString());
    } catch {
      return Response.json({ error: "Invalid currentReading." }, { status: 400 });
    }

    try {
      unitPrice = body.unitPrice !== undefined && body.unitPrice !== null && body.unitPrice !== ""
        ? new Decimal(String(body.unitPrice))
        : new Decimal(bill.unitPrice.toString());
      if (unitPrice.lte(0)) throw new Error();
    } catch {
      return Response.json({ error: "Invalid unitPrice." }, { status: 400 });
    }

    if (currentReading.lt(previousReading)) {
      return Response.json(
        { error: "Current reading cannot be less than the previous reading." },
        { status: 400 }
      );
    }

    const totalAmount = computeTotalFromReadings(previousReading, currentReading, unitPrice);
    if (!totalAmount || totalAmount.lte(0)) {
      return Response.json(
        { error: "Computed bill amount is zero — check your meter readings." },
        { status: 400 }
      );
    }

    const perMemberAmount = computePerMemberAmount(totalAmount, bill.memberCount);
    if (!perMemberAmount) {
      return Response.json({ error: "Failed to compute per-member amount." }, { status: 500 });
    }

    const updated = await db.fridgeBill.update({
      where: { month: monthDate },
      data: {
        previousReading,
        currentReading,
        unitPrice,
        totalAmount,
        perMemberAmount,
      },
    });

    return Response.json({
      data: {
        id: updated.id,
        month: month,
        previousReading: updated.previousReading.toFixed(2),
        currentReading: updated.currentReading.toFixed(2),
        unitPrice: updated.unitPrice.toFixed(4),
        totalAmount: updated.totalAmount.toFixed(2),
        perMemberAmount: updated.perMemberAmount.toFixed(2),
        memberCount: updated.memberCount,
      },
    });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error(err);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
