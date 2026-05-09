// GET /api/dashboard — all data needed for the dashboard in one request

import { requireAuth } from "@/lib/session";
import { db } from "@/lib/db";
import { computeMealRate } from "@/lib/domain/meal";
import { today, currentMonthStart, currentMonthEnd } from "@/lib/utils/dates";
import Decimal from "decimal.js";

export async function GET() {
  try {
    await requireAuth();

    const todayDate = new Date(today());
    const monthStart = currentMonthStart();
    const monthEnd = currentMonthEnd();

    // Today's meals — all active members
    const members = await db.user.findMany({
      where: { status: "active" },
      select: { id: true, name: true, avatarUrl: true },
      orderBy: { name: "asc" },
    });

    const todayRecords = await db.mealRecord.findMany({
      where: {
        date: todayDate,
        userId: { in: members.map((m) => m.id) },
      },
      select: { userId: true, mealCount: true },
    });

    const mealCountMap = new Map(todayRecords.map((r) => [r.userId, r.mealCount]));

    const todayMeals = members.map((m) => ({
      userId: m.id,
      name: m.name,
      avatarUrl: m.avatarUrl,
      mealCount: mealCountMap.get(m.id) ?? 0,
    }));

    const todayTotal = todayMeals.reduce((s, m) => s + m.mealCount, 0);

    // Active bazar trip
    const config = await db.systemConfig.findFirst({
      include: {
        activeTrip: {
          include: {
            assignee1: { select: { id: true, name: true, avatarUrl: true } },
            assignee2: { select: { id: true, name: true, avatarUrl: true } },
          },
        },
      },
    });

    const activeTrip = config?.activeTrip
      ? {
          id: config.activeTrip.id,
          status: config.activeTrip.status,
          triggeredAt: config.activeTrip.triggeredAt.toISOString(),
          shoppingNotes: config.activeTrip.shoppingNotes,
          assignee1: config.activeTrip.assignee1,
          assignee2: config.activeTrip.assignee2,
        }
      : null;

    // Monthly totals
    const bazarRows = await db.bazarExpense.aggregate({
      where: { date: { gte: monthStart, lte: monthEnd } },
      _sum: { amount: true },
    });

    const mealRows = await db.mealRecord.aggregate({
      where: { date: { gte: monthStart, lte: monthEnd } },
      _sum: { mealCount: true },
    });

    const totalBazar = new Decimal(bazarRows._sum.amount?.toString() ?? "0");
    const totalMeals = mealRows._sum.mealCount ?? 0;
    const mealRate = computeMealRate(totalBazar, totalMeals);

    return Response.json({
      data: {
        todayMeals,
        todayTotal,
        activeTrip,
        monthlyTotalBazar: totalBazar.toFixed(2),
        monthlyTotalMeals: totalMeals,
        mealRate: mealRate?.toFixed(2) ?? null,
      },
    });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error(err);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
