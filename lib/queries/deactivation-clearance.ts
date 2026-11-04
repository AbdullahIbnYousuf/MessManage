import type { Prisma } from "@prisma/client";
import { combineDeactivationClearance, participatingBulkCycles } from "@/lib/domain/deactivation";
import { fetchDebtClearance } from "@/lib/queries/debt-clearance";
import { getNow, toDateString } from "@/lib/utils/dates";

type ClearanceClient = Pick<Prisma.TransactionClient,
  | "debtObligation" | "transfer" | "debtRequest" | "mealRecord" | "bulkCycle"
  | "bazarExpense" | "maidCharge" | "maidPayment" | "fridgeAllocation"
  | "fridgePayment" | "bulkAllocation" | "monthlySettlementRun" | "mealEditRequest"
>;

/** Caller supplies the same snapshot used for the final account update. */
export async function fetchDeactivationClearance(client: ClearanceClient, userId: string) {
  const now = getNow();
  const today = new Date(toDateString(now));
  const [debt, meals, activeCycles, expenses, maidCharges, maidPayments,
    fridgeAllocations, fridgePayments, bulkAllocations, finishedPurchases,
    closedMonths, pendingMealCorrectionCount] = await Promise.all([
    fetchDebtClearance(client, userId),
    // Include today's planned consumption, since deactivation only zeros tomorrow onward.
    // Ignore zero rows and all pre-generated future meals.
    client.mealRecord.findMany({
      where: { userId, mealCount: { gt: 0 }, date: { lte: today } },
      select: { date: true },
    }),
    client.bulkCycle.findMany({
      where: { status: "active" },
      select: { id: true, startedAt: true, purchasedById: true, bulkItem: { select: { name: true } } },
    }),
    client.bazarExpense.findMany({ where: { userId, amount: { gt: 0 } }, select: { date: true } }),
    client.maidCharge.findMany({ where: { userId, amount: { gt: 0 } }, select: { month: true } }),
    client.maidPayment.findMany({ where: { paidById: userId, amount: { gt: 0 } }, select: { month: true } }),
    client.fridgeAllocation.findMany({ where: { userId, amount: { gt: 0 } }, select: { bill: { select: { month: true } } } }),
    client.fridgePayment.findMany({ where: { paidById: userId, amount: { gt: 0 } }, select: { bill: { select: { month: true } } } }),
    client.bulkAllocation.findMany({ where: { userId, amount: { gt: 0 } }, select: { allocatedAt: true } }),
    client.bulkCycle.findMany({
      where: { purchasedById: userId, status: "finished", cost: { gt: 0 } },
      select: { finishedAt: true },
    }),
    client.monthlySettlementRun.findMany({ select: { month: true } }),
    client.mealEditRequest.count({ where: { userId, status: "pending" } }),
  ]);

  // Match fetchMonthBalances' UTC first-of-month ranges for financial timestamps.
  // Meal dates and explicit month references are already stored as UTC date-only values.
  const monthOf = (date: Date) => date.toISOString().slice(0, 7);
  return combineDeactivationClearance(debt, {
    unfinishedBulkCycles: participatingBulkCycles({
      userId,
      today: toDateString(now),
      mealDates: meals.map((meal) => toDateString(meal.date)),
      activeCycles: activeCycles.map((cycle) => ({
        id: cycle.id, itemName: cycle.bulkItem.name,
        purchasedById: cycle.purchasedById, startDate: toDateString(cycle.startedAt),
      })),
    }),
    activityMonths: [
      ...meals.map((row) => monthOf(row.date)),
      ...expenses.map((row) => monthOf(row.date)),
      ...maidCharges.map((row) => monthOf(row.month)),
      ...maidPayments.map((row) => monthOf(row.month)),
      ...fridgeAllocations.map((row) => monthOf(row.bill.month)),
      ...fridgePayments.map((row) => monthOf(row.bill.month)),
      ...bulkAllocations.map((row) => monthOf(row.allocatedAt)),
      ...finishedPurchases.flatMap((row) => row.finishedAt ? [monthOf(row.finishedAt)] : []),
    ],
    closedMonths: closedMonths.map((row) => monthOf(row.month)),
    pendingMealCorrectionCount,
  });
}
