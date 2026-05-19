// GET /api/members/[id] — Fetch detailed profile data for a member

import { requireAuth } from "@/lib/session";
import { db } from "@/lib/db";
import { computeNetBalance } from "@/lib/domain/settlement";
import { computeMealRate } from "@/lib/domain/meal";
import { today, currentMonthStart, currentMonthEnd, currentMonthKey, isDeadlinePassed, formatMonthLabel } from "@/lib/utils/dates";
import Decimal from "decimal.js";
import { sum } from "@/lib/utils/decimal";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;

    const user = await db.user.findUnique({
      where: { id },
      include: {
        mealPattern: true,
      },
    });

    if (!user) {
      return Response.json({ error: "User not found." }, { status: 404 });
    }

    const todayDate = new Date(today());
    const monthStart = currentMonthStart();
    const monthEnd = currentMonthEnd();
    const monthDate = new Date(currentMonthKey());

    // --- 1. Recent Activity ---
    const recentBazar = await db.bazarExpense.findMany({
      where: { userId: id },
      orderBy: { date: "desc" },
      take: 5,
    });

    const recentBulk = await db.bulkCycle.findMany({
      where: { purchasedById: id },
      orderBy: { purchaseDate: "desc" },
      take: 3,
      include: { bulkItem: { select: { name: true } } },
    });

    const recentMaid = await db.maidPayment.findMany({
      where: { paidById: id },
      orderBy: { paidAt: "desc" },
      take: 3,
    });

    // --- 2. Financial Aggregates (Current Month) ---
    // Total bazar spend this month (for meal rate) across all users
    const bazarSpendRows = await db.bazarExpense.groupBy({
      by: ["userId"],
      where: { date: { gte: monthStart, lte: monthEnd } },
      _sum: { amount: true },
    });
    
    // Total meals this month (for meal rate) across all users
    const config = await db.systemConfig.findFirst({ select: { mealDeadline: true } });
    const passed = isDeadlinePassed(config?.mealDeadline ?? "11:00");
    const mealCondition = {
      date: { gte: monthStart, lte: monthEnd },
      OR: [{ date: passed ? { lte: todayDate } : { lt: todayDate } }, { isLocked: true }],
    };
    
    const mealRows = await db.mealRecord.groupBy({
      by: ["userId"],
      where: mealCondition,
      _sum: { mealCount: true },
    });

    const totalMonthBazar = sum(bazarSpendRows.map((r) => r._sum.amount?.toString() ?? "0"));
    const totalMonthMeals = mealRows.reduce((s, r) => s + (r._sum.mealCount ?? 0), 0);
    const mealRate = computeMealRate(totalMonthBazar, totalMonthMeals);

    // This User's Data
    const userBazarRow = bazarSpendRows.find(r => r.userId === id);
    const userBazarSpend = new Decimal(userBazarRow?._sum.amount?.toString() ?? "0");
    
    const userMealRow = mealRows.find(r => r.userId === id);
    const userMealCount = userMealRow?._sum.mealCount ?? 0;
    const userMealCost = mealRate ? mealRate.mul(userMealCount) : new Decimal(0);

    const maidPaymentRows = await db.maidPayment.aggregate({
      where: { paidById: id, month: monthDate },
      _sum: { amount: true },
    });
    const userMaidPayments = new Decimal(maidPaymentRows._sum.amount?.toString() ?? "0");

    const fridgePaymentRows = await db.fridgePayment.aggregate({
      where: { paidById: id, paidAt: { gte: monthStart, lte: monthEnd } },
      _sum: { amount: true },
    });
    const userFridgePayments = new Decimal(fridgePaymentRows._sum.amount?.toString() ?? "0");

    const bulkPurchaseRows = await db.bulkCycle.aggregate({
      where: { purchasedById: id, finishedAt: { gte: monthStart, lte: monthEnd } },
      _sum: { cost: true },
    });
    const userBulkPurchases = new Decimal(bulkPurchaseRows._sum.cost?.toString() ?? "0");

    const maidChargeRows = await db.maidCharge.aggregate({
      where: { userId: id, month: monthDate },
      _sum: { amount: true },
    });
    const userMaidCharges = new Decimal(maidChargeRows._sum.amount?.toString() ?? "0");

    const fridgeBills = await db.fridgeBill.findMany({
      where: { postedAt: { gte: monthStart, lte: monthEnd } },
      select: { perMemberAmount: true },
    });
    const totalFridgeBillShare = fridgeBills.reduce(
      (s, b) => s.add(new Decimal(b.perMemberAmount.toString())),
      new Decimal(0)
    );

    const bulkAllocRows = await db.bulkAllocation.aggregate({
      where: { userId: id, allocatedAt: { gte: monthStart, lte: monthEnd } },
      _sum: { amount: true },
    });
    const userBulkAllocations = new Decimal(bulkAllocRows._sum.amount?.toString() ?? "0");
    
    const bazarVisitCount = await db.bazarExpense.count({
      where: { userId: id, date: { gte: monthStart, lte: monthEnd } },
    });

    const netBalance = computeNetBalance({
      totalBazarSpend: userBazarSpend,
      totalMaidPayments: userMaidPayments,
      totalFridgePayments: userFridgePayments,
      totalBulkPurchases: userBulkPurchases,
      totalMealCost: userMealCost,
      totalMaidCharges: userMaidCharges,
      totalFridgeBillShare: totalFridgeBillShare,
      totalBulkAllocations: userBulkAllocations,
    });

    const routineSpending = userBazarSpend.add(userMaidPayments).add(userFridgePayments);
    const totalSpending = routineSpending.add(userBulkPurchases);

    // Build response payload
    const responseData = {
      user: {
        id: user.id,
        name: user.name,
        nickname: user.nickname,
        avatarUrl: user.avatarUrl,
        email: user.email,
        status: user.status,
        joinedAt: user.joinedAt,
        phoneNumber: user.phoneNumber,
        phoneNumber2: user.phoneNumber2,
        bkashNumber: user.bkashNumber,
        bankName: user.bankName,
        bankAccountNumber: user.bankAccountNumber,
        emergencyContactName: user.emergencyContactName,
        emergencyContactPhone: user.emergencyContactPhone,
        emergencyContactRelation: user.emergencyContactRelation,
      },
      mealPattern: user.mealPattern,
      aggregates: {
        balance: netBalance.toFixed(2),
        routineSpending: routineSpending.toFixed(2),
        totalSpending: totalSpending.toFixed(2),
        totalMeals: userMealCount,
        bazarVisits: bazarVisitCount,
        monthLabel: formatMonthLabel(currentMonthKey()),
        breakdown: {
          bazarContributed: userBazarSpend.toFixed(2),
          maidPayments: userMaidPayments.toFixed(2),
          fridgePayments: userFridgePayments.toFixed(2),
          bulkPurchases: userBulkPurchases.toFixed(2),
          mealCost: userMealCost.toFixed(2),
          maidCharge: userMaidCharges.toFixed(2),
          fridgeBillShare: totalFridgeBillShare.toFixed(2),
          bulkAllocations: userBulkAllocations.toFixed(2),
        },
      },
      activity: {
        recentBazar: recentBazar.map(b => ({ id: b.id, amount: b.amount.toString(), date: b.date, note: b.note })),
        recentBulk: recentBulk.map(b => ({ id: b.id, itemName: b.bulkItem.name, cost: b.cost.toString(), date: b.purchaseDate })),
        recentMaid: recentMaid.map(m => ({ id: m.id, amount: m.amount.toString(), month: m.month })),
      }
    };

    return Response.json({ data: responseData });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error(err);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
