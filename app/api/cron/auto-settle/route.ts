// GET /api/cron/auto-settle — cron job to automatically run month-end settlement
// Runs on the 5th of every month. Settles the *previous* calendar month.

import { db } from "@/lib/db";
import { computeSettlement } from "@/lib/domain/settlement";
import { previousMonthKey, previousMonthStart, previousMonthEnd, getNow } from "@/lib/utils/dates";
import { fetchMonthBalances } from "@/lib/queries/balance";
import Decimal from "decimal.js";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorised" }, { status: 401 });
  }

  try {
    const monthKey = previousMonthKey();
    const monthDate = new Date(monthKey);

    // Block duplicate settlement — skip silently if already settled (idempotent)
    const existing = await db.monthlySettlement.findFirst({
      where: { month: monthDate },
    });
    if (existing) {
      return Response.json({ message: "Already settled for the previous month." });
    }

    const result = await fetchMonthBalances({
      monthStart: previousMonthStart(),
      monthEnd: previousMonthEnd(),
      monthDate,
      isCurrentMonth: false, // past month — all meals are locked, no deadline logic
    });

    // Block if no data to settle (e.g., app just deployed, or system inactive)
    if (!result.hasData) {
      return Response.json({ message: "No data to settle for the previous month." });
    }

    const monthStart = previousMonthStart();
    const monthEnd = previousMonthEnd();

    // Validate matching aggregates before running settlement
    const [
      actualMaidCharges,
      actualMaidPayments,
      actualFridgeBills,
      actualFridgePayments,
      actualBulkCycles,
      actualBulkAllocations,
    ] = await Promise.all([
      db.maidCharge.aggregate({ where: { month: monthDate }, _sum: { amount: true } }),
      db.maidPayment.aggregate({ where: { month: monthDate }, _sum: { amount: true } }),
      db.fridgeBill.aggregate({ where: { postedAt: { gte: monthStart, lte: monthEnd } }, _sum: { totalAmount: true } }),
      db.fridgePayment.aggregate({ where: { paidAt: { gte: monthStart, lte: monthEnd } }, _sum: { amount: true } }),
      db.bulkCycle.aggregate({ where: { finishedAt: { gte: monthStart, lte: monthEnd } }, _sum: { cost: true } }),
      db.bulkAllocation.aggregate({ where: { allocatedAt: { gte: monthStart, lte: monthEnd } }, _sum: { amount: true } }),
    ]);

    const maidChargesSum = new Decimal(actualMaidCharges._sum.amount?.toString() ?? "0");
    const maidPaymentsSum = new Decimal(actualMaidPayments._sum.amount?.toString() ?? "0");
    const fridgeBillsSum = new Decimal(actualFridgeBills._sum.totalAmount?.toString() ?? "0");
    const fridgePaymentsSum = new Decimal(actualFridgePayments._sum.amount?.toString() ?? "0");
    const bulkCyclesSum = new Decimal(actualBulkCycles._sum.cost?.toString() ?? "0");
    const bulkAllocationsSum = new Decimal(actualBulkAllocations._sum.amount?.toString() ?? "0");

    const validationErrors = [];
    if (!maidChargesSum.equals(maidPaymentsSum)) {
      validationErrors.push(`Maid charges (৳${maidChargesSum.toFixed(2)}) do not match maid payments (৳${maidPaymentsSum.toFixed(2)}).`);
    }
    if (!fridgeBillsSum.equals(fridgePaymentsSum)) {
      validationErrors.push(`Fridge bills (৳${fridgeBillsSum.toFixed(2)}) do not match fridge payments (৳${fridgePaymentsSum.toFixed(2)}).`);
    }
    if (!bulkCyclesSum.equals(bulkAllocationsSum)) {
      validationErrors.push(`Bulk purchases (৳${bulkCyclesSum.toFixed(2)}) do not match bulk allocations (৳${bulkAllocationsSum.toFixed(2)}).`);
    }

    if (validationErrors.length > 0) {
      console.warn("Auto-settlement skipped due to unbalanced aggregates:", validationErrors.join(" "));
      return Response.json({ message: "Auto-settlement skipped: " + validationErrors.join(" ") });
    }

    const transfers = computeSettlement(result.members);
    const now = getNow();

    // Write all settlement rows atomically
    await db.$transaction(async (tx) => {
      await tx.monthlySettlement.createMany({
        data: transfers.map((t) => ({
          month: monthDate,
          fromUserId: t.fromUserId,
          toUserId: t.toUserId,
          amount: t.amount,
          settledAt: now,
        })),
      });
    });

    return Response.json({ message: "Auto-settlement completed successfully.", transfers });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Something went wrong." }, { status: 500 });
  }
}
