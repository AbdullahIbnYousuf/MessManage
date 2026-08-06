import { db } from "@/lib/db";
import { fetchMonthBalances } from "@/lib/queries/balance";
import { fetchDebtPayments, fetchDebtSummary } from "@/lib/queries/debts";
import { fetchSettlementReadiness } from "@/lib/queries/settlement-readiness";
import {
  firstDayOfMonth,
  getDhakaParts,
  getNow,
  lastDayOfMonth,
} from "@/lib/utils/dates";
import { sum } from "@/lib/utils/decimal";
import type { DebtPaymentLedgerEntry } from "@/types/debts";
import type { MoneySummary } from "@/types/money";

type MoneySummaryDependencies = {
  fetchMonthBalances: typeof fetchMonthBalances;
  fetchSettlementReadiness: typeof fetchSettlementReadiness;
  fetchDebtSummary: typeof fetchDebtSummary;
  fetchDebtPayments: typeof fetchDebtPayments;
  findSettlement: (month: Date) => Promise<{ settledAt: Date } | null>;
};

const defaultDependencies: MoneySummaryDependencies = {
  fetchMonthBalances,
  fetchSettlementReadiness,
  fetchDebtSummary,
  fetchDebtPayments,
  findSettlement: (month) => db.monthlySettlementRun.findUnique({
    where: { month },
    select: { settledAt: true },
  }),
};

function getMonthContext(now: Date) {
  const { y, m } = getDhakaParts(now);
  const currentDate = firstDayOfMonth(y, m);
  const previousYear = m === 1 ? y - 1 : y;
  const previousMonth = m === 1 ? 12 : m - 1;
  const previousDate = firstDayOfMonth(previousYear, previousMonth);

  return {
    current: {
      date: currentDate,
      start: currentDate,
      end: lastDayOfMonth(y, m),
      key: currentDate.toISOString().slice(0, 7),
    },
    previous: {
      date: previousDate,
      start: previousDate,
      end: lastDayOfMonth(previousYear, previousMonth),
      key: previousDate.toISOString().slice(0, 7),
    },
  };
}

export async function fetchMoneySummary({
  currentUserId,
  confirmedMoneyEnabled,
  now = getNow(),
  dependencies = defaultDependencies,
}: {
  currentUserId: string;
  confirmedMoneyEnabled: boolean;
  now?: Date;
  dependencies?: MoneySummaryDependencies;
}): Promise<MoneySummary> {
  const months = getMonthContext(now);
  const confirmedPromise = confirmedMoneyEnabled
    ? Promise.all([
        dependencies.fetchDebtSummary(currentUserId),
        dependencies.fetchDebtPayments({
          currentUserId,
          action: "needs_response",
          status: "pending",
          limit: 3,
        }),
      ])
    : Promise.resolve(null);

  const [currentResult, previousSettlement] = await Promise.all([
    dependencies.fetchMonthBalances({
      monthStart: months.current.start,
      monthEnd: months.current.end,
      monthDate: months.current.date,
      isCurrentMonth: true,
    }),
    dependencies.findSettlement(months.previous.date),
  ]);

  const currentMember = currentResult.members.find(
    (member) => member.userId === currentUserId
  );
  if (!currentMember) {
    throw new Error("Authenticated member is missing from monthly balances.");
  }

  const credits = sum([
    currentMember.breakdown.bazarContributed,
    currentMember.breakdown.maidPayments,
    currentMember.breakdown.fridgePayments,
    currentMember.breakdown.bulkPurchases,
  ]);
  const costs = sum([
    currentMember.breakdown.mealCost,
    currentMember.breakdown.maidCharge,
    currentMember.breakdown.fridgeBillShare,
    currentMember.breakdown.bulkAllocations,
  ]);

  let previousClosing: MoneySummary["previousClosing"];
  if (previousSettlement) {
    previousClosing = {
      month: months.previous.key,
      status: "closed",
      settledAt: previousSettlement.settledAt.toISOString(),
      issues: [],
    };
  } else {
    const [previousResult, issues] = await Promise.all([
      dependencies.fetchMonthBalances({
        monthStart: months.previous.start,
        monthEnd: months.previous.end,
        monthDate: months.previous.date,
        isCurrentMonth: false,
      }),
      dependencies.fetchSettlementReadiness({
        monthStart: months.previous.start,
        monthEnd: months.previous.end,
        monthDate: months.previous.date,
      }),
    ]);
    previousClosing = {
      month: months.previous.key,
      status: !previousResult.hasData
        ? "no_activity"
        : issues.length > 0
          ? "blocked"
          : "ready",
      settledAt: null,
      issues: previousResult.hasData ? issues : [],
    };
  }

  const confirmedResult = await confirmedPromise;
  const confirmedMoney = confirmedResult
    ? (() => {
        const [summary, pendingPage] = confirmedResult;
        const pendingResponses = pendingPage.entries.filter(
          (entry): entry is DebtPaymentLedgerEntry => entry.type === "payment"
        );
        return {
          youOwe: summary.youOwe,
          owedToYou: summary.owedToYou,
          net: summary.net,
          pairwiseCount: summary.pairwise.length,
          pairwise: summary.pairwise.slice(0, 3),
          pendingResponseCount: summary.pendingPaymentResponseCount,
          pendingInitiatedCount: summary.pendingPaymentInitiatedCount,
          pendingResponses,
          recentActivity: summary.recentActivity.slice(0, 3),
        };
      })()
    : null;

  const balance = currentMember.balance;
  return {
    generatedAt: now.toISOString(),
    currentMonth: {
      month: months.current.key,
      balance: balance.toFixed(2),
      direction: balance.gt(0) ? "owed" : balance.lt(0) ? "owes" : "balanced",
      credits: credits.toFixed(2),
      costs: costs.toFixed(2),
      totalMeals: currentMember.meals,
      mealRate: currentResult.mealRate?.toFixed(4) ?? null,
      hasData: currentResult.hasData,
      breakdown: {
        bazarContributed: currentMember.breakdown.bazarContributed.toFixed(2),
        maidPayments: currentMember.breakdown.maidPayments.toFixed(2),
        fridgePayments: currentMember.breakdown.fridgePayments.toFixed(2),
        bulkPurchases: currentMember.breakdown.bulkPurchases.toFixed(2),
        mealCost: currentMember.breakdown.mealCost.toFixed(2),
        maidCharge: currentMember.breakdown.maidCharge.toFixed(2),
        fridgeBillShare: currentMember.breakdown.fridgeBillShare.toFixed(2),
        bulkAllocations: currentMember.breakdown.bulkAllocations.toFixed(2),
      },
    },
    previousClosing,
    confirmedMoneyEnabled,
    confirmedMoney,
  };
}
