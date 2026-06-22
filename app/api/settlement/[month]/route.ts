// GET /api/settlement/[month] — full data for the post-settlement monthly report

import { requireAuth } from "@/lib/session";
import { db } from "@/lib/db";
import { computeMealRate } from "@/lib/domain/meal";
import { firstDayOfMonth, lastDayOfMonth } from "@/lib/utils/dates";
import Decimal from "decimal.js";
import { sum } from "@/lib/utils/decimal";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ month: string }> }
) {
  try {
    await requireAuth();
    const { month: monthKey } = await params; // e.g. "2025-05"

    const [yearStr, monthStr] = monthKey.split("-");
    if (!yearStr || !monthStr) {
      return Response.json({ error: "Invalid month format." }, { status: 400 });
    }

    const year  = parseInt(yearStr);
    const month = parseInt(monthStr);
    const monthDate  = new Date(`${monthKey}-01`);
    const monthStart = firstDayOfMonth(year, month);
    const monthEnd   = lastDayOfMonth(year, month);

    // ── 1. Verify the month is settled ──────────────────────────────────────
    const settlements = await db.monthlySettlement.findMany({
      where: { month: monthDate },
      include: {
        fromUser: { select: { name: true, nickname: true, avatarUrl: true } },
        toUser:   { select: { name: true, nickname: true, avatarUrl: true } },
      },
      orderBy: { amount: "desc" },
    });

    if (settlements.length === 0) {
      return Response.json(
        { error: "This month has not been settled yet." },
        { status: 404 }
      );
    }

    // ── 2. Pull all historical data for this month ───────────────────────────
    const [
      bazarExpenses,
      mealRecords,
      maidCharges,
      maidPayments,
      bulkAllocations,
      bulkCycles,
      fridgePayments,
      fridgeBills,
      fridgeAllocations,
      members,
    ] = await Promise.all([
      db.bazarExpense.findMany({
        where: { date: { gte: monthStart, lte: monthEnd } },
      }),
      db.mealRecord.findMany({
        where: { date: { gte: monthStart, lte: monthEnd }, mealCount: { gt: 0 } },
      }),
      db.maidCharge.findMany({ where: { month: monthDate } }),
      db.maidPayment.findMany({ where: { month: monthDate } }),
      db.bulkAllocation.findMany({
        where: { allocatedAt: { gte: monthStart, lte: monthEnd } },
        include: { cycle: { include: { bulkItem: { select: { name: true } } } } },
      }),
      db.bulkCycle.findMany({
        where: { finishedAt: { gte: monthStart, lte: monthEnd } },
        include: { bulkItem: { select: { name: true } }, purchasedBy: { select: { id: true, name: true, nickname: true } } },
      }),
      db.fridgePayment.findMany({
        where: { bill: { month: monthDate } },
      }),
      db.fridgeBill.findMany({
        where: { month: monthDate },
        select: { totalAmount: true },
      }),
      db.fridgeAllocation.findMany({
        where: { bill: { month: monthDate } },
      }),
      db.user.findMany({
        select: { id: true, name: true, nickname: true, avatarUrl: true },
      }),
    ]);

    // ── 3. Group Stats ───────────────────────────────────────────────────────
    const totalBazar     = sum(bazarExpenses.map((e) => e.amount.toString()));
    const totalMeals     = mealRecords.reduce((s, r) => s + r.mealCount, 0);
    const mealRate       = computeMealRate(totalBazar, totalMeals);
    const tripCount      = new Set(bazarExpenses.map((e) => e.tripId)).size;

    // top bazar contributor by spend
    const spendByUser = new Map<string, Decimal>();
    for (const e of bazarExpenses) {
      const prev = spendByUser.get(e.userId) ?? new Decimal(0);
      spendByUser.set(e.userId, prev.add(e.amount.toString()));
    }
    let topSpenderUserId: string | null = null;
    let topSpenderAmount = new Decimal(0);
    for (const [uid, amt] of spendByUser) {
      if (amt.gt(topSpenderAmount)) { topSpenderAmount = amt; topSpenderUserId = uid; }
    }
    const topSpender = members.find((m) => m.id === topSpenderUserId);

    // bulk cycles that closed this month
    const closedCycles = bulkCycles.map((c) => ({
      id: c.id,
      itemName: c.bulkItem.name,
      cost: c.cost.toString(),
      purchasedBy: c.purchasedBy.nickname ?? c.purchasedBy.name,
    }));

    // fridge total for the month
    const totalFridgeBillAmount = sum(fridgeBills.map((b) => b.totalAmount.toString()));

    // ── 4. Per-Person Breakdown ──────────────────────────────────────────────
    const personBreakdown = members.map((m) => {
      // Credits
      const bazarContributed = sum(bazarExpenses.filter((e) => e.userId === m.id).map((e) => e.amount.toString()));
      const maidPaymentMade  = sum(maidPayments.filter((p) => p.paidById === m.id).map((p) => p.amount.toString()));
      const bulkPurchaseMade = sum(bulkCycles.filter((c) => c.purchasedById === m.id).map((c) => c.cost.toString()));
      const fridgePaymentMade = sum(fridgePayments.filter((p) => p.paidById === m.id).map((p) => p.amount.toString()));

      // Debits
      const userMeals       = mealRecords.filter((r) => r.userId === m.id).reduce((s, r) => s + r.mealCount, 0);
      const mealCost        = mealRate ? mealRate.mul(userMeals) : new Decimal(0);
      const maidCharge      = sum(maidCharges.filter((c) => c.userId === m.id).map((c) => c.amount.toString()));

      // Bulk allocations — group by item name for display
      const userBulkAllocs  = bulkAllocations.filter((a) => a.userId === m.id);
      const bulkAllocByItem = userBulkAllocs.map((a) => ({
        itemName: a.cycle.bulkItem.name,
        amount:   a.amount.toString(),
      }));
      const bulkAllocTotal  = sum(userBulkAllocs.map((a) => a.amount.toString()));

      const fridgeShare = sum(
        fridgeAllocations
          .filter((allocation) => allocation.userId === m.id)
          .map((allocation) => allocation.amount.toString())
      );

      // Net
      const credits = bazarContributed.add(maidPaymentMade).add(bulkPurchaseMade).add(fridgePaymentMade);
      const debits  = mealCost.add(maidCharge).add(bulkAllocTotal).add(fridgeShare);
      const netBalance = credits.sub(debits);

      return {
        userId:   m.id,
        name:     m.nickname ?? m.name,
        avatarUrl: m.avatarUrl,
        meals:    userMeals,
        mealRate: mealRate ? mealRate.toString() : null,
        credits: {
          bazarContributed:  bazarContributed.toString(),
          maidPaymentMade:   maidPaymentMade.toString(),
          bulkPurchaseMade:  bulkPurchaseMade.toString(),
          fridgePaymentMade: fridgePaymentMade.toString(),
        },
        debits: {
          mealCost:       mealCost.toString(),
          maidCharge:     maidCharge.toString(),
          bulkAllocTotal: bulkAllocTotal.toString(),
          bulkAllocByItem,
          fridgeShare:    fridgeShare.toString(),
        },
        netBalance: netBalance.toString(),
      };
    });

    // ── 5. Bazar Leaderboard ─────────────────────────────────────────────────
    const visitsByUser = new Map<string, number>();
    for (const e of bazarExpenses) {
      visitsByUser.set(e.userId, (visitsByUser.get(e.userId) ?? 0) + 1);
    }

    const leaderboard = members
      .map((m) => ({
        userId:     m.id,
        name:       m.nickname ?? m.name,
        avatarUrl:  m.avatarUrl,
        totalSpent: (spendByUser.get(m.id) ?? new Decimal(0)).toString(),
        visitCount: visitsByUser.get(m.id) ?? 0,
      }))
      .filter((l) => l.visitCount > 0)
      .sort((a, b) => new Decimal(b.totalSpent).minus(new Decimal(a.totalSpent)).toNumber());

    // ── 6. Response ──────────────────────────────────────────────────────────
    return Response.json({
      data: {
        month:     monthKey,
        settledAt: settlements[0]?.settledAt,
        stats: {
          totalBazar:           totalBazar.toString(),
          totalMeals,
          mealRate:             mealRate ? mealRate.toString() : null,
          tripCount,
          topSpenderName:       topSpender ? (topSpender.nickname ?? topSpender.name) : null,
          topSpenderAmount:     topSpenderAmount.toString(),
          closedCycles,
          totalFridgeBillAmount: totalFridgeBillAmount.toString(),
        },
        settlementPlan: settlements.map((s) => ({
          id:     s.id,
          from:   s.fromUser.nickname ?? s.fromUser.name,
          fromAvatar: s.fromUser.avatarUrl,
          to:     s.toUser.nickname ?? s.toUser.name,
          toAvatar: s.toUser.avatarUrl,
          amount: s.amount.toString(),
        })),
        personBreakdown,
        leaderboard,
      },
    });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Something went wrong." }, { status: 500 });
  }
}
