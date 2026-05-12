// GET /api/cron/auto-settle — cron job to automatically run month-end settlement
// Runs on the 5th of every month. Settles the *previous* calendar month.

import { db } from "@/lib/db";
import { computeSettlement, computeNetBalance, type BalanceEntry } from "@/lib/domain/settlement";
import { computeMealRate } from "@/lib/domain/meal";
import { previousMonthKey, previousMonthStart, previousMonthEnd } from "@/lib/utils/dates";
import Decimal from "decimal.js";
import { sum } from "@/lib/utils/decimal";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorised" }, { status: 401 });
  }

  try {
    const monthKey = previousMonthKey();
    const monthDate = new Date(monthKey);
    const monthStart = previousMonthStart();
    const monthEnd = previousMonthEnd();

    // Block duplicate settlement — skip silently if already settled (idempotent)
    const existing = await db.monthlySettlement.findFirst({
      where: { month: monthDate },
    });
    if (existing) {
      return Response.json({ message: "Already settled for the previous month." });
    }

    const members = await db.user.findMany({
      select: { id: true, name: true, nickname: true, avatarUrl: true },
    });

    // Bazar spend
    const bazarSpendRows = await db.bazarExpense.groupBy({
      by: ["userId"],
      where: { date: { gte: monthStart, lte: monthEnd } },
      _sum: { amount: true },
    });

    // Meals (since it's the previous month, all days are past the deadline and locked, so we just use the date filter)
    const mealRows = await db.mealRecord.groupBy({
      by: ["userId"],
      where: { date: { gte: monthStart, lte: monthEnd } },
      _sum: { mealCount: true },
    });

    const totalMonthBazar = sum(bazarSpendRows.map((r) => r._sum.amount?.toString() ?? "0"));
    const totalMonthMeals = mealRows.reduce((s, r) => s + (r._sum.mealCount ?? 0), 0);
    const mealRate = computeMealRate(totalMonthBazar, totalMonthMeals);

    const maidChargeRows = await db.maidCharge.groupBy({ by: ["userId"], _sum: { amount: true } });
    const maidPaymentRows = await db.maidPayment.groupBy({ by: ["paidById"], _sum: { amount: true } });
    const bulkAllocRows = await db.bulkAllocation.groupBy({ by: ["userId"], _sum: { amount: true } });
    const bulkPurchaseRows = await db.bulkCycle.groupBy({ by: ["purchasedById"], _sum: { cost: true } });
    const fridgePaymentRows = await db.fridgePayment.groupBy({ by: ["paidById"], _sum: { amount: true } });
    const fridgeBills = await db.fridgeBill.findMany({ select: { perMemberAmount: true } });

    // Block if no data to settle (e.g., app just deployed, or system inactive)
    const hasData = totalMonthMeals > 0 || Number(totalMonthBazar) > 0 || maidChargeRows.length > 0 || fridgeBills.length > 0 || bulkPurchaseRows.length > 0;
    if (!hasData) {
      return Response.json({ message: "No data to settle for the previous month." });
    }

    const bazarMap = new Map(bazarSpendRows.map((r) => [r.userId, new Decimal(r._sum.amount?.toString() ?? "0")]));
    const mealMap = new Map(mealRows.map((r) => [r.userId, r._sum.mealCount ?? 0]));
    const maidChargeMap = new Map(maidChargeRows.map((r) => [r.userId, new Decimal(r._sum.amount?.toString() ?? "0")]));
    const maidPaymentMap = new Map(maidPaymentRows.map((r) => [r.paidById, new Decimal(r._sum.amount?.toString() ?? "0")]));
    const bulkAllocMap = new Map(bulkAllocRows.map((r) => [r.userId, new Decimal(r._sum.amount?.toString() ?? "0")]));
    const bulkPurchaseMap = new Map(bulkPurchaseRows.map((r) => [r.purchasedById, new Decimal(r._sum.cost?.toString() ?? "0")]));
    const fridgePaymentMap = new Map(fridgePaymentRows.map((r) => [r.paidById, new Decimal(r._sum.amount?.toString() ?? "0")]));

    const totalFridgeBillShare = fridgeBills.reduce(
      (s, b) => s.add(new Decimal(b.perMemberAmount.toString())),
      new Decimal(0)
    );

    const ZERO = new Decimal(0);

    const balances: BalanceEntry[] = members.map((m) => {
      const userMeals = mealMap.get(m.id) ?? 0;
      const mealCost = mealRate ? mealRate.mul(userMeals) : ZERO;
      return {
        userId: m.id,
        name: m.nickname || m.name,
        avatarUrl: m.avatarUrl,
        balance: computeNetBalance({
          totalBazarSpend: bazarMap.get(m.id) ?? ZERO,
          totalMaidPayments: maidPaymentMap.get(m.id) ?? ZERO,
          totalFridgePayments: fridgePaymentMap.get(m.id) ?? ZERO,
          totalBulkPurchases: bulkPurchaseMap.get(m.id) ?? ZERO,
          totalMealCost: mealCost,
          totalMaidCharges: maidChargeMap.get(m.id) ?? ZERO,
          totalFridgeBillShare,
          totalBulkAllocations: bulkAllocMap.get(m.id) ?? ZERO,
        }),
      };
    });

    const transfers = computeSettlement(balances);
    const now = new Date();

    // Write all settlement rows atomically
    await db.monthlySettlement.createMany({
      data: transfers.map((t) => ({
        month: monthDate,
        fromUserId: t.fromUserId,
        toUserId: t.toUserId,
        amount: t.amount,
        settledAt: now,
      })),
    });

    return Response.json({ message: "Auto-settlement completed successfully.", transfers });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Something went wrong." }, { status: 500 });
  }
}
