import Decimal from "decimal.js";
import { db } from "@/lib/db";
import { fetchFridgeMonthTotals } from "@/lib/queries/fridge";

export type SettlementReadinessOptions = {
  monthDate: Date;
  monthStart: Date;
  monthEnd: Date;
};

export async function fetchSettlementReadiness(
  options: SettlementReadinessOptions
): Promise<string[]> {
  const { monthDate, monthStart, monthEnd } = options;
  const [
    actualMaidCharges,
    actualMaidPayments,
    fridgeTotals,
    actualBulkCycles,
    actualBulkAllocations,
  ] = await Promise.all([
    db.maidCharge.aggregate({
      where: { month: monthDate },
      _sum: { amount: true },
    }),
    db.maidPayment.aggregate({
      where: { month: monthDate },
      _sum: { amount: true },
    }),
    fetchFridgeMonthTotals(monthDate),
    db.bulkCycle.aggregate({
      where: { finishedAt: { gte: monthStart, lte: monthEnd } },
      _sum: { cost: true },
    }),
    db.bulkAllocation.aggregate({
      where: { allocatedAt: { gte: monthStart, lte: monthEnd } },
      _sum: { amount: true },
    }),
  ]);

  const maidCharges = new Decimal(actualMaidCharges._sum.amount?.toString() ?? "0");
  const maidPayments = new Decimal(actualMaidPayments._sum.amount?.toString() ?? "0");
  const bulkCycles = new Decimal(actualBulkCycles._sum.cost?.toString() ?? "0");
  const bulkAllocations = new Decimal(
    actualBulkAllocations._sum.amount?.toString() ?? "0"
  );
  const reasons: string[] = [];

  if (!maidCharges.eq(maidPayments)) {
    reasons.push(
      `Maid charges (৳${maidCharges.toFixed(2)}) do not match maid payments (৳${maidPayments.toFixed(2)}).`
    );
  }
  if (!fridgeTotals.billTotal.eq(fridgeTotals.allocationTotal)) {
    reasons.push(
      `Fridge bills (৳${fridgeTotals.billTotal.toFixed(2)}) do not match frozen allocations (৳${fridgeTotals.allocationTotal.toFixed(2)}).`
    );
  }
  if (!fridgeTotals.billTotal.eq(fridgeTotals.paymentTotal)) {
    reasons.push(
      `Fridge bills (৳${fridgeTotals.billTotal.toFixed(2)}) do not match fridge payments (৳${fridgeTotals.paymentTotal.toFixed(2)}).`
    );
  }
  if (!bulkCycles.eq(bulkAllocations)) {
    reasons.push(
      `Bulk purchases (৳${bulkCycles.toFixed(2)}) do not match bulk allocations (৳${bulkAllocations.toFixed(2)}).`
    );
  }

  return reasons;
}
