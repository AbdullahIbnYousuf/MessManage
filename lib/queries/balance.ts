// Shared balance computation — fetches all monthly aggregates and computes
// per-member net balances. Used by:
//   - GET  /api/settlement/balance (current month view)
//   - POST /api/settlement/run     (manual settlement)
//   - GET  /api/cron/auto-settle   (cron settlement)
//
// This file intentionally contains database calls because it is a *query*
// helper, not pure domain logic. The domain formulas it relies on live in
// lib/domain/settlement.ts and lib/domain/meal.ts.

import { db } from "@/lib/db";
import { computeNetBalance, type BalanceEntry } from "@/lib/domain/settlement";
import { computeMealRate } from "@/lib/domain/meal";
import { isDeadlinePassed, today } from "@/lib/utils/dates";
import { sum } from "@/lib/utils/decimal";
import Decimal from "decimal.js";

// ─── Types ───────────────────────────────────────────────────────────────────

/** Per-member breakdown of credits and debits for display. */
export type BalanceBreakdown = {
  bazarContributed: Decimal;
  maidPayments: Decimal;
  fridgePayments: Decimal;
  bulkPurchases: Decimal;
  mealCost: Decimal;
  maidCharge: Decimal;
  fridgeBillShare: Decimal;
  bulkAllocations: Decimal;
};

/** Full result for a single member including balance + optional breakdown. */
export type MemberBalanceResult = BalanceEntry & {
  status: string;
  meals: number;
  breakdown: BalanceBreakdown;
};

/** Everything returned by fetchMonthBalances. */
export type MonthBalanceResult = {
  members: MemberBalanceResult[];
  mealRate: Decimal | null;
  totalMonthBazar: Decimal;
  totalMonthMeals: number;
  /** Whether the month had any financial activity at all. */
  hasData: boolean;
};

// ─── Options ─────────────────────────────────────────────────────────────────

export type FetchMonthBalancesOptions = {
  /** First day of the month (Date at local midnight). */
  monthStart: Date;
  /** Last day of the month (Date at local midnight). */
  monthEnd: Date;
  /** Month reference as a Date (first of month) — used for MaidCharge.month etc. */
  monthDate: Date;
  /**
   * If true, applies deadline-aware meal filtering for the current month:
   * only counts meals up to today (or through today if the deadline has passed).
   * If false, counts all meals in the date range (appropriate for past months
   * where all records are locked).
   */
  isCurrentMonth: boolean;
};

// ─── Main Function ───────────────────────────────────────────────────────────

/**
 * Fetches all monthly aggregates and computes net balances for every member.
 *
 * This is the single source of truth for balance computation across the app.
 * Any bug fix here automatically applies to the balance view, manual settlement,
 * and the auto-settle cron job.
 */
export async function fetchMonthBalances(
  options: FetchMonthBalancesOptions
): Promise<MonthBalanceResult> {
  const { monthStart, monthEnd, monthDate, isCurrentMonth } = options;
  const ZERO = new Decimal(0);

  // ── 1. Fetch members ────────────────────────────────────────────────────
  const members = await db.user.findMany({
    select: { id: true, name: true, nickname: true, avatarUrl: true, status: true },
    orderBy: { name: "asc" },
  });

  // ── 2. Bazar expenses grouped by user ───────────────────────────────────
  const bazarSpendRows = await db.bazarExpense.groupBy({
    by: ["userId"],
    where: { date: { gte: monthStart, lte: monthEnd } },
    _sum: { amount: true },
  });

  // ── 3. Meal records grouped by user ─────────────────────────────────────
  // For current month: only count meals that are either locked or whose date
  // is today-or-earlier (respecting the meal deadline).
  // For past months: all meals in the range are counted (they're all locked).
  let mealWhere: object;

  if (isCurrentMonth) {
    const config = await db.systemConfig.findFirst({
      select: { mealDeadline: true },
    });
    const deadlineStr = config?.mealDeadline ?? "22:00";
    const passed = isDeadlinePassed(deadlineStr);
    const todayDate = new Date(today());

    mealWhere = {
      date: { gte: monthStart, lte: monthEnd },
      OR: [
        { date: passed ? { lte: todayDate } : { lt: todayDate } },
        { isLocked: true },
      ],
    };
  } else {
    mealWhere = {
      date: { gte: monthStart, lte: monthEnd },
    };
  }

  const mealRows = await db.mealRecord.groupBy({
    by: ["userId"],
    where: mealWhere,
    _sum: { mealCount: true },
  });

  // ── 4. All other aggregates (parallel where possible) ───────────────────
  const [
    maidChargeRows,
    maidPaymentRows,
    bulkAllocRows,
    bulkPurchaseRows,
    fridgePaymentRows,
    fridgeBills,
  ] = await Promise.all([
    db.maidCharge.groupBy({
      by: ["userId"],
      where: { month: monthDate },
      _sum: { amount: true },
    }),
    db.maidPayment.groupBy({
      by: ["paidById"],
      where: { month: monthDate },
      _sum: { amount: true },
    }),
    db.bulkAllocation.groupBy({
      by: ["userId"],
      where: { allocatedAt: { gte: monthStart, lte: monthEnd } },
      _sum: { amount: true },
    }),
    db.bulkCycle.groupBy({
      by: ["purchasedById"],
      where: { finishedAt: { gte: monthStart, lte: monthEnd } },
      _sum: { cost: true },
    }),
    db.fridgePayment.groupBy({
      by: ["paidById"],
      where: { paidAt: { gte: monthStart, lte: monthEnd } },
      _sum: { amount: true },
    }),
    db.fridgeBill.findMany({
      where: { postedAt: { gte: monthStart, lte: monthEnd } },
      select: { perMemberAmount: true },
    }),
  ]);

  // ── 5. Build lookup maps ────────────────────────────────────────────────
  const bazarMap = new Map(
    bazarSpendRows.map((r) => [r.userId, new Decimal(r._sum.amount?.toString() ?? "0")])
  );
  const mealMap = new Map(
    mealRows.map((r) => [r.userId, r._sum.mealCount ?? 0])
  );
  const maidChargeMap = new Map(
    maidChargeRows.map((r) => [r.userId, new Decimal(r._sum.amount?.toString() ?? "0")])
  );
  const maidPaymentMap = new Map(
    maidPaymentRows.map((r) => [r.paidById, new Decimal(r._sum.amount?.toString() ?? "0")])
  );
  const bulkAllocMap = new Map(
    bulkAllocRows.map((r) => [r.userId, new Decimal(r._sum.amount?.toString() ?? "0")])
  );
  const bulkPurchaseMap = new Map(
    bulkPurchaseRows.map((r) => [r.purchasedById, new Decimal(r._sum.cost?.toString() ?? "0")])
  );
  const fridgePaymentMap = new Map(
    fridgePaymentRows.map((r) => [r.paidById, new Decimal(r._sum.amount?.toString() ?? "0")])
  );

  const totalFridgeBillShare = fridgeBills.reduce(
    (s, b) => s.add(new Decimal(b.perMemberAmount.toString())),
    ZERO
  );

  // ── 6. Compute totals and meal rate ─────────────────────────────────────
  const totalMonthBazar = sum(
    bazarSpendRows.map((r) => r._sum.amount?.toString() ?? "0")
  );
  const totalMonthMeals = mealRows.reduce(
    (s, r) => s + (r._sum.mealCount ?? 0),
    0
  );
  const mealRate = computeMealRate(totalMonthBazar, totalMonthMeals);

  // ── 7. Per-member balance computation ───────────────────────────────────
  const memberResults: MemberBalanceResult[] = members.map((m) => {
    const userMeals = mealMap.get(m.id) ?? 0;
    const mealCost = mealRate ? mealRate.mul(userMeals) : ZERO;

    const bazarContributed = bazarMap.get(m.id) ?? ZERO;
    const maidPayments = maidPaymentMap.get(m.id) ?? ZERO;
    const fridgePayments = fridgePaymentMap.get(m.id) ?? ZERO;
    const bulkPurchases = bulkPurchaseMap.get(m.id) ?? ZERO;
    const maidCharge = maidChargeMap.get(m.id) ?? ZERO;
    const bulkAllocations = bulkAllocMap.get(m.id) ?? ZERO;

    const balance = computeNetBalance({
      totalBazarSpend: bazarContributed,
      totalMaidPayments: maidPayments,
      totalFridgePayments: fridgePayments,
      totalBulkPurchases: bulkPurchases,
      totalMealCost: mealCost,
      totalMaidCharges: maidCharge,
      totalFridgeBillShare: totalFridgeBillShare,
      totalBulkAllocations: bulkAllocations,
    });

    return {
      userId: m.id,
      name: m.nickname || m.name,
      avatarUrl: m.avatarUrl,
      status: m.status,
      meals: userMeals,
      balance,
      breakdown: {
        bazarContributed,
        maidPayments,
        fridgePayments,
        bulkPurchases,
        mealCost,
        maidCharge,
        fridgeBillShare: totalFridgeBillShare,
        bulkAllocations,
      },
    };
  });

  // ── 8. Check if there was any activity ──────────────────────────────────
  const hasData =
    totalMonthMeals > 0 ||
    !totalMonthBazar.isZero() ||
    maidChargeRows.length > 0 ||
    fridgeBills.length > 0 ||
    bulkPurchaseRows.length > 0;

  return {
    members: memberResults,
    mealRate,
    totalMonthBazar,
    totalMonthMeals,
    hasData,
  };
}
