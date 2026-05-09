// POST /api/settlement/run — run month-end settlement (admin only)

import { requireAdmin } from "@/lib/session";
import { db } from "@/lib/db";
import { computeSettlement, computeNetBalance, type BalanceEntry } from "@/lib/domain/settlement";
import { computeMealRate } from "@/lib/domain/meal";
import { today, currentMonthStart, currentMonthEnd, currentMonthKey, isDeadlinePassed } from "@/lib/utils/dates";
import Decimal from "decimal.js";
import { sum } from "@/lib/utils/decimal";

export async function POST() {
  try {
    await requireAdmin();

    const monthKey = currentMonthKey();
    const monthDate = new Date(monthKey);
    const todayDate = new Date(today());
    const monthStart = currentMonthStart();
    const monthEnd = currentMonthEnd();

    // Block duplicate settlement
    const existing = await db.monthlySettlement.findFirst({
      where: { month: monthDate },
    });
    if (existing) {
      return Response.json({ error: "This month has already been settled." }, { status: 400 });
    }

    const members = await db.user.findMany({
      select: { id: true, name: true, avatarUrl: true },
    });

    // Gather all the same aggregates as the balance route
    const bazarSpendRows = await db.bazarExpense.groupBy({
      by: ["userId"],
      where: { date: { gte: monthStart, lte: monthEnd } },
      _sum: { amount: true },
    });

    const config = await db.systemConfig.findFirst({
      select: { mealDeadline: true },
    });
    const deadlineStr = config?.mealDeadline ?? "11:00";
    const passed = isDeadlinePassed(deadlineStr);

    const mealCondition = {
      date: { gte: monthStart, lte: monthEnd },
      OR: [
        { date: passed ? { lte: todayDate } : { lt: todayDate } },
        { isLocked: true },
      ],
    };

    const mealRows = await db.mealRecord.groupBy({
      by: ["userId"],
      where: mealCondition,
      _sum: { mealCount: true },
    });
    const totalMonthBazar = sum(bazarSpendRows.map((r) => r._sum.amount?.toString() ?? "0"));
    const totalMonthMeals = mealRows.reduce((s, r) => s + (r._sum.mealCount ?? 0), 0);
    const mealRate = computeMealRate(totalMonthBazar, totalMonthMeals);

    const bazarMap = new Map(bazarSpendRows.map((r) => [r.userId, new Decimal(r._sum.amount?.toString() ?? "0")]));
    const mealMap = new Map(mealRows.map((r) => [r.userId, r._sum.mealCount ?? 0]));

    const maidChargeRows = await db.maidCharge.groupBy({ by: ["userId"], _sum: { amount: true } });
    const maidPaymentRows = await db.maidPayment.groupBy({ by: ["paidById"], _sum: { amount: true } });
    const bulkAllocRows = await db.bulkAllocation.groupBy({ by: ["userId"], _sum: { amount: true } });

    const maidChargeMap = new Map(maidChargeRows.map((r) => [r.userId, new Decimal(r._sum.amount?.toString() ?? "0")]));
    const maidPaymentMap = new Map(maidPaymentRows.map((r) => [r.paidById, new Decimal(r._sum.amount?.toString() ?? "0")]));
    const bulkAllocMap = new Map(bulkAllocRows.map((r) => [r.userId, new Decimal(r._sum.amount?.toString() ?? "0")]));

    const ZERO = new Decimal(0);

    const balances: BalanceEntry[] = members.map((m) => {
      const userMeals = mealMap.get(m.id) ?? 0;
      const mealCost = mealRate ? mealRate.mul(userMeals) : ZERO;
      return {
        userId: m.id,
        name: m.name,
        avatarUrl: m.avatarUrl,
        balance: computeNetBalance({
          totalBazarSpend: bazarMap.get(m.id) ?? ZERO,
          totalMaidPayments: maidPaymentMap.get(m.id) ?? ZERO,
          totalMealCost: mealCost,
          totalMaidCharges: maidChargeMap.get(m.id) ?? ZERO,
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

    return Response.json({
      data: {
        month: monthKey,
        transfers: transfers.map((t) => ({
          fromUserId: t.fromUserId,
          fromUserName: t.fromUserName,
          toUserId: t.toUserId,
          toUserName: t.toUserName,
          amount: t.amount.toFixed(2),
        })),
      },
    });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error(err);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
