// GET /api/settlement/balance — compute current net balance for all members

import { requireAuth } from "@/lib/session";
import { currentMonthStart, currentMonthEnd, currentMonthKey, firstDayOfMonth, lastDayOfMonth } from "@/lib/utils/dates";
import { fetchMonthBalances } from "@/lib/queries/balance";
import { db } from "@/lib/db";
import { fetchFridgeMonthTotals } from "@/lib/queries/fridge";
import Decimal from "decimal.js";

export async function GET(request: Request) {
  try {
    await requireAuth();

    const { searchParams } = new URL(request.url);
    const monthQuery = searchParams.get("month"); // format "YYYY-MM"

    let monthStart: Date;
    let monthEnd: Date;
    let monthDate: Date;
    let isCurrent = true;
    let monthKey = currentMonthKey(); // default to current month's "YYYY-MM-01"

    if (monthQuery && /^\d{4}-\d{2}$/.test(monthQuery)) {
      const [yearStr, monthStr] = monthQuery.split("-");
      const year = parseInt(yearStr!);
      const month = parseInt(monthStr!);
      
      monthStart = firstDayOfMonth(year, month);
      monthEnd = lastDayOfMonth(year, month);
      monthDate = new Date(`${monthQuery}-01`);
      isCurrent = `${monthQuery}-01` === currentMonthKey();
      monthKey = `${monthQuery}-01`;
    } else {
      monthStart = currentMonthStart();
      monthEnd = currentMonthEnd();
      monthDate = new Date(currentMonthKey());
      isCurrent = true;
    }

    const [
      result,
      existingSettlement,
      actualMaidCharges,
      actualMaidPayments,
      fridgeTotals,
      actualBulkCycles,
      actualBulkAllocations,
    ] = await Promise.all([
      fetchMonthBalances({
        monthStart,
        monthEnd,
        monthDate,
        isCurrentMonth: isCurrent,
      }),
      db.monthlySettlement.findFirst({
        where: { month: monthDate },
      }),
      db.maidCharge.aggregate({ where: { month: monthDate }, _sum: { amount: true } }),
      db.maidPayment.aggregate({ where: { month: monthDate }, _sum: { amount: true } }),
      fetchFridgeMonthTotals(monthDate),
      db.bulkCycle.aggregate({ where: { finishedAt: { gte: monthStart, lte: monthEnd } }, _sum: { cost: true } }),
      db.bulkAllocation.aggregate({ where: { allocatedAt: { gte: monthStart, lte: monthEnd } }, _sum: { amount: true } }),
    ]);

    const maidChargesSum = new Decimal(actualMaidCharges._sum.amount?.toString() ?? "0");
    const maidPaymentsSum = new Decimal(actualMaidPayments._sum.amount?.toString() ?? "0");
    const fridgeBillsSum = fridgeTotals.billTotal;
    const fridgeAllocationsSum = fridgeTotals.allocationTotal;
    const fridgePaymentsSum = fridgeTotals.paymentTotal;
    const bulkCyclesSum = new Decimal(actualBulkCycles._sum.cost?.toString() ?? "0");
    const bulkAllocationsSum = new Decimal(actualBulkAllocations._sum.amount?.toString() ?? "0");

    const validationErrors = [];
    if (!maidChargesSum.equals(maidPaymentsSum)) {
      validationErrors.push({
        type: "maid",
        message: `Maid charges (৳${maidChargesSum.toFixed(2)}) do not match maid payments (৳${maidPaymentsSum.toFixed(2)}).`,
      });
    }
    if (!fridgeBillsSum.equals(fridgeAllocationsSum)) {
      validationErrors.push({
        type: "fridge",
        message: `Fridge bills (৳${fridgeBillsSum.toFixed(2)}) do not match frozen allocations (৳${fridgeAllocationsSum.toFixed(2)}).`,
      });
    }
    if (!fridgeBillsSum.equals(fridgePaymentsSum)) {
      validationErrors.push({
        type: "fridge",
        message: `Fridge bills (৳${fridgeBillsSum.toFixed(2)}) do not match fridge payments (৳${fridgePaymentsSum.toFixed(2)}).`,
      });
    }
    if (!bulkCyclesSum.equals(bulkAllocationsSum)) {
      validationErrors.push({
        type: "bulk",
        message: `Bulk purchases (৳${bulkCyclesSum.toFixed(2)}) do not match bulk allocations (৳${bulkAllocationsSum.toFixed(2)}).`,
      });
    }

    return Response.json({
      data: {
        month: monthKey.slice(0, 7), // "YYYY-MM"
        currentMonth: currentMonthKey().slice(0, 7), // "YYYY-MM"
        isSettled: existingSettlement !== null,
        balances: result.members.map((m) => ({
          userId: m.userId,
          name: m.name,
          avatarUrl: m.avatarUrl,
          status: m.status,
          balance: m.balance.toFixed(2),
          breakdown: {
            bazarContributed: m.breakdown.bazarContributed.toFixed(2),
            maidPayments: m.breakdown.maidPayments.toFixed(2),
            fridgePayments: m.breakdown.fridgePayments.toFixed(2),
            bulkPurchases: m.breakdown.bulkPurchases.toFixed(2),
            mealCost: m.breakdown.mealCost.toFixed(2),
            maidCharge: m.breakdown.maidCharge.toFixed(2),
            fridgeBillShare: m.breakdown.fridgeBillShare.toFixed(2),
            bulkAllocations: m.breakdown.bulkAllocations.toFixed(2),
          },
        })),
        mealRate: result.mealRate?.toFixed(4) ?? null,
        totalMonthBazar: result.totalMonthBazar.toFixed(2),
        totalMonthMeals: result.totalMonthMeals,
        validationErrors,
      },
    });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error(err);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
