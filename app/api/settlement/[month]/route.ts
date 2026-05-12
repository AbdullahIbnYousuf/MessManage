// GET /api/settlement/[month] — fetch all details for a settled month report

import { requireAuth } from "@/lib/session";
import { db } from "@/lib/db";
import { computeMealRate } from "@/lib/domain/meal";
import { firstDayOfMonth, lastDayOfMonth } from "@/lib/utils/dates";
import Decimal from "decimal.js";
import { sum } from "@/lib/utils/decimal";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ month: string }> }
) {
  try {
    const session = await requireAuth();
    const { month: monthKey } = await params; // e.g. "2024-11"

    const [yearStr, monthStr] = monthKey.split("-");
    if (!yearStr || !monthStr) {
      return Response.json({ error: "Invalid month format." }, { status: 400 });
    }

    const year = parseInt(yearStr);
    const month = parseInt(monthStr);
    const monthDate = new Date(`${monthKey}-01`);
    const monthStart = firstDayOfMonth(year, month);
    const monthEnd = lastDayOfMonth(year, month);

    // 1. Check if the month is settled
    const settlements = await db.monthlySettlement.findMany({
      where: { month: monthDate },
      include: {
        fromUser: { select: { name: true, nickname: true, avatarUrl: true } },
        toUser: { select: { name: true, nickname: true, avatarUrl: true } },
      },
    });

    if (settlements.length === 0) {
      return Response.json({ error: "This month has not been settled yet." }, { status: 404 });
    }

    // 2. Gather historical data for that specific month
    const [bazarExpenses, mealRecords, maidCharges, maidPayments, bulkAllocations, bulkCycles, fridgePayments, fridgeBills] = await Promise.all([
      db.bazarExpense.findMany({
        where: { date: { gte: monthStart, lte: monthEnd } },
        include: { user: { select: { id: true, name: true, nickname: true } } },
      }),
      db.mealRecord.findMany({
        where: { date: { gte: monthStart, lte: monthEnd } },
        include: { user: { select: { id: true, name: true, nickname: true } } },
      }),
      db.maidCharge.findMany({
        where: { month: monthDate },
      }),
      db.maidPayment.findMany({
        where: { month: monthDate },
      }),
      db.bulkAllocation.findMany({
        where: { allocatedAt: { gte: monthStart, lte: monthEnd } },
      }),
      db.bulkCycle.findMany({
        where: { finishedAt: { gte: monthStart, lte: monthEnd } },
      }),
      db.fridgePayment.findMany({
        where: { paidAt: { gte: monthStart, lte: monthEnd } },
      }),
      db.fridgeBill.findMany({
        where: { postedAt: { gte: monthStart, lte: monthEnd } },
      }),
    ]);

    const members = await db.user.findMany({
      select: { id: true, name: true, nickname: true, avatarUrl: true },
    });

    // 3. Compute Stats
    const totalBazar = sum(bazarExpenses.map((e) => e.amount.toString()));
    const totalMeals = mealRecords.reduce((s, r) => s + r.mealCount, 0);
    const mealRate = computeMealRate(totalBazar, totalMeals);

    // 4. Leaderboard
    const leaderboard = members.map((m) => {
      const userExpenses = bazarExpenses.filter((e) => e.userId === m.id);
      const totalSpent = sum(userExpenses.map((e) => e.amount.toString()));
      const visitCount = userExpenses.length;
      return {
        userId: m.id,
        name: m.nickname || m.name,
        avatarUrl: m.avatarUrl,
        totalSpent: totalSpent.toString(),
        visitCount,
      };
    }).sort((a, b) => new Decimal(b.totalSpent).minus(new Decimal(a.totalSpent)).toNumber());

    // 5. Per-person breakdown
    const personBreakdown = members.map((m) => {
      const userMeals = mealRecords.filter((r) => r.userId === m.id).reduce((s, r) => s + r.mealCount, 0);
      const userMealCost = mealRate ? mealRate.mul(userMeals) : new Decimal(0);
      const userMaidCharge = sum(maidCharges.filter((c) => c.userId === m.id).map((c) => c.amount.toString()));
      const userBulkAlloc = sum(bulkAllocations.filter((a) => a.userId === m.id).map((a) => a.amount.toString()));
      
      // Fridge bill share
      const userFridgeBillShare = sum(fridgeBills.map(b => b.perMemberAmount.toString()));

      const totalConsumption = userMealCost.add(userMaidCharge).add(userBulkAlloc).add(userFridgeBillShare);
      const costPerMeal = userMeals > 0 ? totalConsumption.div(userMeals) : null;

      return {
        userId: m.id,
        name: m.nickname || m.name,
        avatarUrl: m.avatarUrl,
        meals: userMeals,
        breakdown: {
          mealCost: userMealCost.toString(),
          maidCharge: userMaidCharge.toString(),
          bulkAllocation: userBulkAlloc.toString(),
          fridgeBillShare: userFridgeBillShare.toString(),
          totalConsumption: totalConsumption.toString(),
        },
        costPerMeal: costPerMeal ? costPerMeal.toString() : null,
      };
    });

    return Response.json({
      data: {
        month: monthKey,
        settledAt: settlements[0]?.settledAt,
        stats: {
          totalBazar: totalBazar.toString(),
          totalMeals,
          mealRate: mealRate ? mealRate.toString() : null,
        },
        settlements: settlements.map(s => ({
          id: s.id,
          from: s.fromUser.nickname || s.fromUser.name,
          to: s.toUser.nickname || s.toUser.name,
          amount: s.amount.toString(),
        })),
        leaderboard,
        personBreakdown,
      }
    });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Something went wrong." }, { status: 500 });
  }
}
