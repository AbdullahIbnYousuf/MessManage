// GET /api/settlement/balance — compute current net balance for all members

import { requireAuth } from "@/lib/session";
import { db } from "@/lib/db";
import { computeNetBalance } from "@/lib/domain/settlement";
import { computeMealRate } from "@/lib/domain/meal";
import { currentMonthStart, currentMonthEnd } from "@/lib/utils/dates";
import Decimal from "decimal.js";
import { sum } from "@/lib/utils/decimal";

export async function GET() {
  try {
    await requireAuth();

    const monthStart = currentMonthStart();
    const monthEnd = currentMonthEnd();

    const members = await db.user.findMany({
      select: { id: true, name: true, avatarUrl: true, status: true },
      orderBy: { name: "asc" },
    });

    // Total bazar spend this month (for meal rate)
    const bazarSpendRows = await db.bazarExpense.groupBy({
      by: ["userId"],
      where: { date: { gte: monthStart, lte: monthEnd } },
      _sum: { amount: true },
    });

    // Total meals this month (for meal rate)
    const mealRows = await db.mealRecord.groupBy({
      by: ["userId"],
      where: { date: { gte: monthStart, lte: monthEnd } },
      _sum: { mealCount: true },
    });

    const totalMonthBazar = sum(
      bazarSpendRows.map((r) => r._sum.amount?.toString() ?? "0")
    );
    const totalMonthMeals = mealRows.reduce((s, r) => s + (r._sum.mealCount ?? 0), 0);
    const mealRate = computeMealRate(totalMonthBazar, totalMonthMeals);

    // Per-user aggregates
    const bazarMap = new Map(bazarSpendRows.map((r) => [r.userId, new Decimal(r._sum.amount?.toString() ?? "0")]));
    const mealMap = new Map(mealRows.map((r) => [r.userId, r._sum.mealCount ?? 0]));

    // Maid charges
    const maidChargeRows = await db.maidCharge.groupBy({
      by: ["userId"],
      _sum: { amount: true },
    });
    const maidChargeMap = new Map(maidChargeRows.map((r) => [r.userId, new Decimal(r._sum.amount?.toString() ?? "0")]));

    // Maid payments
    const maidPaymentRows = await db.maidPayment.groupBy({
      by: ["paidById"],
      _sum: { amount: true },
    });
    const maidPaymentMap = new Map(maidPaymentRows.map((r) => [r.paidById, new Decimal(r._sum.amount?.toString() ?? "0")]));

    // Bulk allocations
    const bulkAllocRows = await db.bulkAllocation.groupBy({
      by: ["userId"],
      _sum: { amount: true },
    });
    const bulkAllocMap = new Map(bulkAllocRows.map((r) => [r.userId, new Decimal(r._sum.amount?.toString() ?? "0")]));

    const ZERO = new Decimal(0);

    const balances = members.map((m) => {
      const userMeals = mealMap.get(m.id) ?? 0;
      const mealCost = mealRate ? mealRate.mul(userMeals) : ZERO;

      const balance = computeNetBalance({
        totalBazarSpend: bazarMap.get(m.id) ?? ZERO,
        totalMaidPayments: maidPaymentMap.get(m.id) ?? ZERO,
        totalMealCost: mealCost,
        totalMaidCharges: maidChargeMap.get(m.id) ?? ZERO,
        totalBulkAllocations: bulkAllocMap.get(m.id) ?? ZERO,
      });

      return {
        userId: m.id,
        name: m.name,
        avatarUrl: m.avatarUrl,
        status: m.status,
        balance: balance.toFixed(2),
        breakdown: {
          bazarContributed: (bazarMap.get(m.id) ?? ZERO).toFixed(2),
          maidPayments: (maidPaymentMap.get(m.id) ?? ZERO).toFixed(2),
          mealCost: mealCost.toFixed(2),
          maidCharge: (maidChargeMap.get(m.id) ?? ZERO).toFixed(2),
          bulkAllocations: (bulkAllocMap.get(m.id) ?? ZERO).toFixed(2),
        },
      };
    });

    return Response.json({
      data: {
        balances,
        mealRate: mealRate?.toFixed(4) ?? null,
        totalMonthBazar: totalMonthBazar.toFixed(2),
        totalMonthMeals,
      },
    });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error(err);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
