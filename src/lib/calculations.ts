// ============================================================
// Calculation Engine — Meal Rate, Balance, Expense Derivation
// All values are derived at query time, never stored.
// ============================================================

import type {
  MealRecord, BazarExpense, MaidCharge, MaidPayment,
  BulkAllocation, UserBalance, MealRateInfo, SmartSettlementPlan, User,
} from '@/types';

/**
 * Meal Rate = Total bazar spending for month / Total meals taken by all members that month
 */
export function calculateMealRate(
  bazarExpenses: BazarExpense[],
  mealRecords: MealRecord[]
): MealRateInfo {
  const totalBazar = bazarExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalMeals = mealRecords.reduce((sum, r) => sum + r.meal_count, 0);
  const mealRate = totalMeals > 0 ? totalBazar / totalMeals : 0;

  return {
    month: '',
    total_bazar_spending: totalBazar,
    total_meals: totalMeals,
    meal_rate: Math.round(mealRate * 100) / 100,
  };
}

/**
 * User Meal Cost = Meal rate × meals taken by user
 */
export function calculateUserMealCost(
  mealRate: number,
  userMealRecords: MealRecord[]
): number {
  const totalMeals = userMealRecords.reduce((sum, r) => sum + r.meal_count, 0);
  return Math.round(mealRate * totalMeals * 100) / 100;
}

/**
 * User Monthly Expense = Meal cost + Maid charge + Bulk item allocation
 */
export function calculateUserMonthlyExpense(
  mealCost: number,
  maidCharge: number,
  bulkAllocation: number
): number {
  return Math.round((mealCost + maidCharge + bulkAllocation) * 100) / 100;
}

/**
 * Net Balance = Bazar contributions + Maid payments - Meal cost - Maid charge - Bulk allocations
 * Positive = owed money. Negative = owes money.
 */
export function calculateUserBalance(
  userId: string,
  userName: string,
  bazarExpenses: BazarExpense[],
  maidPayments: MaidPayment[],
  mealRate: number,
  userMealRecords: MealRecord[],
  userMaidCharges: MaidCharge[],
  userBulkAllocations: BulkAllocation[]
): UserBalance {
  const totalBazarContribution = bazarExpenses
    .filter(e => e.user_id === userId)
    .reduce((sum, e) => sum + e.amount, 0);

  const totalMaidPayment = maidPayments
    .filter(p => p.paid_by === userId)
    .reduce((sum, p) => sum + p.amount, 0);

  const totalMealCost = calculateUserMealCost(mealRate, userMealRecords);

  const totalMaidCharge = userMaidCharges
    .reduce((sum, c) => sum + c.amount, 0);

  const totalBulkAllocation = userBulkAllocations
    .reduce((sum, a) => sum + a.amount, 0);

  const netBalance = totalBazarContribution + totalMaidPayment - totalMealCost - totalMaidCharge - totalBulkAllocation;

  return {
    user_id: userId,
    user_name: userName,
    total_bazar_contribution: Math.round(totalBazarContribution * 100) / 100,
    total_maid_payment: Math.round(totalMaidPayment * 100) / 100,
    total_meal_cost: Math.round(totalMealCost * 100) / 100,
    total_maid_charge: Math.round(totalMaidCharge * 100) / 100,
    total_bulk_allocation: Math.round(totalBulkAllocation * 100) / 100,
    net_balance: Math.round(netBalance * 100) / 100,
  };
}

/**
 * Smart Settlement — minimizes number of transactions to settle all balances.
 * Uses a greedy creditor/debtor matching algorithm.
 */
export function calculateSmartSettlement(balances: UserBalance[]): SmartSettlementPlan {
  const debtors = balances
    .filter(b => b.net_balance < 0)
    .map(b => ({ id: b.user_id, name: b.user_name, amount: -b.net_balance }))
    .sort((a, b) => b.amount - a.amount);

  const creditors = balances
    .filter(b => b.net_balance > 0)
    .map(b => ({ id: b.user_id, name: b.user_name, amount: b.net_balance }))
    .sort((a, b) => b.amount - a.amount);

  const transfers: SmartSettlementPlan['transfers'] = [];

  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    const amount = Math.min(debtor.amount, creditor.amount);

    if (amount > 0.005) {
      transfers.push({
        from_user_id: debtor.id,
        from_user_name: debtor.name,
        to_user_id: creditor.id,
        to_user_name: creditor.name,
        amount: Math.round(amount * 100) / 100,
      });
    }

    debtor.amount -= amount;
    creditor.amount -= amount;

    if (debtor.amount < 0.005) i++;
    if (creditor.amount < 0.005) j++;
  }

  return { transfers };
}

/**
 * Get the day-of-week key from a date string
 */
export function getDayOfWeek(dateStr: string): string {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const d = new Date(dateStr + 'T00:00:00');
  return days[d.getDay()];
}

/**
 * Get all dates in a month
 */
export function getDatesInMonth(year: number, month: number): string[] {
  const dates: string[] = [];
  const daysInMonth = new Date(year, month, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    dates.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  return dates;
}

/**
 * Format currency in Taka
 */
export function formatTaka(amount: number): string {
  return `৳${amount.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

/**
 * Get the first day of current month as YYYY-MM-DD
 */
export function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

/**
 * Get today's date as YYYY-MM-DD
 */
export function getToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * Check if a time string has passed today (deadline check)
 */
export function isDeadlinePassed(deadlineTime: string): boolean {
  const now = new Date();
  const [hours, minutes] = deadlineTime.split(':').map(Number);
  const deadline = new Date(now);
  deadline.setHours(hours, minutes, 0, 0);
  return now >= deadline;
}

/**
 * Check if a date is in the past
 */
export function isPastDate(dateStr: string): boolean {
  const today = getToday();
  return dateStr < today;
}

/**
 * Check if a date is today
 */
export function isToday(dateStr: string): boolean {
  return dateStr === getToday();
}

/**
 * Format a date string for display
 */
export function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/**
 * Format month for display
 */
export function formatMonth(monthStr: string): string {
  const d = new Date(monthStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}
