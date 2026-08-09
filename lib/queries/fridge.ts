import Decimal from "decimal.js";
import { db } from "@/lib/db";

export type FridgeMonthTotals = {
  billTotal: Decimal;
  allocationTotal: Decimal;
  paymentTotal: Decimal;
};

/** Fetches the three frozen fridge totals for one bill month. */
export async function fetchFridgeMonthTotals(
  month: Date
): Promise<FridgeMonthTotals> {
  const [bills, allocations, payments] = await Promise.all([
    db.fridgeBill.aggregate({
      where: { month },
      _sum: { totalAmount: true },
    }),
    db.fridgeAllocation.aggregate({
      where: { bill: { month } },
      _sum: { amount: true },
    }),
    db.fridgePayment.aggregate({
      where: { bill: { month } },
      _sum: { amount: true },
    }),
  ]);

  return {
    billTotal: new Decimal(bills._sum.totalAmount?.toString() ?? "0"),
    allocationTotal: new Decimal(allocations._sum.amount?.toString() ?? "0"),
    paymentTotal: new Decimal(payments._sum.amount?.toString() ?? "0"),
  };
}
