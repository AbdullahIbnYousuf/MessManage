import type { PrismaClient } from "@prisma/client";
import Decimal from "decimal.js";
import { db } from "@/lib/db";
import {
  firstDayOfMonth,
  getDhakaParts,
  getNow,
  parseDateString,
  toDateString,
} from "@/lib/utils/dates";
import type { ExpensesSummary } from "@/types/expenses";

type ExpensesSummaryClient = Pick<
  PrismaClient,
  | "bulkItem"
  | "maidCharge"
  | "maidPayment"
  | "fridgeBill"
  | "monthlySettlementRun"
  | "systemConfig"
>;

function monthContext(now: Date) {
  const { y, m } = getDhakaParts(now);
  const currentMonthDate = firstDayOfMonth(y, m);
  const previousMonthDate = firstDayOfMonth(m === 1 ? y - 1 : y, m === 1 ? 12 : m - 1);

  return {
    currentMonthDate,
    previousMonthDate,
    currentMonth: currentMonthDate.toISOString().slice(0, 7),
    previousMonth: previousMonthDate.toISOString().slice(0, 7),
  };
}

function calendarDaysActive(startedAt: Date, now: Date): number {
  const start = parseDateString(toDateString(startedAt));
  const end = parseDateString(toDateString(now));
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86_400_000));
}

export async function fetchExpensesSummary(
  client: ExpensesSummaryClient = db,
  now: Date = getNow()
): Promise<ExpensesSummary> {
  const {
    currentMonthDate,
    previousMonthDate,
    currentMonth,
    previousMonth,
  } = monthContext(now);

  const [
    items,
    maidCharges,
    maidPayments,
    fridgeBill,
    settlementRuns,
    config,
  ] = await Promise.all([
    client.bulkItem.findMany({
      select: {
        id: true,
        name: true,
        unit: true,
        cycles: {
          where: { status: "active" },
          orderBy: { startedAt: "desc" },
          take: 1,
          select: {
            id: true,
            cost: true,
            purchaseDate: true,
            startedAt: true,
            purchasedBy: {
              select: {
                id: true,
                name: true,
                nickname: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    client.maidCharge.aggregate({
      where: { month: currentMonthDate },
      _count: { _all: true },
      _sum: { amount: true },
    }),
    client.maidPayment.aggregate({
      where: { month: currentMonthDate },
      _count: { _all: true },
      _sum: { amount: true },
    }),
    client.fridgeBill.findUnique({
      where: { month: previousMonthDate },
      select: {
        id: true,
        totalAmount: true,
        memberCount: true,
        previousReading: true,
        currentReading: true,
        payments: { select: { amount: true } },
      },
    }),
    client.monthlySettlementRun.findMany({
      where: { month: { in: [currentMonthDate, previousMonthDate] } },
      select: { month: true },
    }),
    client.systemConfig.findFirst({
      select: { maidChargeDefault: true },
    }),
  ]);

  const settledMonths = new Set(
    settlementRuns.map((run) => run.month.toISOString().slice(0, 7))
  );
  const currentMonthSettled = settledMonths.has(currentMonth);
  const previousMonthSettled = settledMonths.has(previousMonth);
  const activeCycles: ExpensesSummary["bulk"]["activeCycles"] = [];
  const missingItems: ExpensesSummary["bulk"]["missingItems"] = [];

  for (const item of items) {
    const cycle = item.cycles[0];
    if (!cycle) {
      missingItems.push({ id: item.id, name: item.name, unit: item.unit });
      continue;
    }

    activeCycles.push({
      itemId: item.id,
      itemName: item.name,
      unit: item.unit,
      cycleId: cycle.id,
      cost: cycle.cost.toFixed(2),
      purchaseDate: cycle.purchaseDate.toISOString().slice(0, 10),
      startedAt: cycle.startedAt.toISOString(),
      daysActive: calendarDaysActive(cycle.startedAt, now),
      purchasedBy: {
        id: cycle.purchasedBy.id,
        name: cycle.purchasedBy.nickname || cycle.purchasedBy.name,
        avatarUrl: cycle.purchasedBy.avatarUrl,
      },
    });
  }

  const fridgePayments = fridgeBill?.payments ?? [];
  const fridgePaymentTotal = fridgePayments.reduce(
    (total, payment) => total.add(payment.amount),
    new Decimal(0)
  );

  return {
    generatedAt: now.toISOString(),
    currentMonth,
    previousMonth,
    bulk: {
      itemCount: items.length,
      activeCycleCount: activeCycles.length,
      missingCycleCount: missingItems.length,
      activeCycles,
      missingItems,
    },
    maid: {
      month: currentMonth,
      status: maidCharges._count._all > 0
        ? "applied"
        : currentMonthSettled
          ? "settled_zero"
          : "not_applied",
      chargeCount: maidCharges._count._all,
      chargeTotal: new Decimal(maidCharges._sum.amount?.toString() ?? "0").toFixed(2),
      paymentCount: maidPayments._count._all,
      paymentTotal: new Decimal(maidPayments._sum.amount?.toString() ?? "0").toFixed(2),
      defaultCharge: new Decimal(config?.maidChargeDefault?.toString() ?? "700").toFixed(2),
    },
    fridge: {
      month: previousMonth,
      status: previousMonthSettled
        ? "settled"
        : fridgeBill
          ? "posted"
          : "not_posted",
      billId: fridgeBill?.id ?? null,
      totalAmount: fridgeBill?.totalAmount.toFixed(2) ?? "0.00",
      paymentCount: fridgePayments.length,
      paymentTotal: fridgePaymentTotal.toFixed(2),
      previousReading: fridgeBill?.previousReading.toFixed(2) ?? null,
      currentReading: fridgeBill?.currentReading.toFixed(2) ?? null,
      unitsUsed: fridgeBill
        ? fridgeBill.currentReading.sub(fridgeBill.previousReading).toFixed(2)
        : null,
      memberCount: fridgeBill?.memberCount ?? null,
    },
  };
}
