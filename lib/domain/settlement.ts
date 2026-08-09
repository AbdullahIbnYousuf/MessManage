// Pure business logic for settlement.
// No HTTP, no database calls.

import Decimal from "decimal.js";
import { minDecimal } from "@/lib/utils/decimal";
import { FinancialError } from "@/lib/domain/financial-errors";

export type BalanceEntry = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  balance: Decimal; // positive = owed money, negative = owes money
};

export type SettlementTransfer = {
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  amount: Decimal;
};

/**
 * Smart settlement algorithm — greedy matching.
 * Computes the minimum number of transfers to resolve all balances.
 *
 * Steps:
 * 1. Separate creditors (positive) and debtors (negative)
 * 2. Sort both lists largest-first by absolute value
 * 3. Match largest debtor with largest creditor
 * 4. Transfer = min(abs(debtor), creditor)
 * 5. Reduce both by transfer amount, remove zeroes
 * 6. Repeat until all balances are zero
 */
export function computeSettlement(balances: BalanceEntry[]): SettlementTransfer[] {
  const ZERO = new Decimal(0);
  const transfers: SettlementTransfer[] = [];

  // Work on mutable copies
  const creditors = balances
    .filter((b) => b.balance.gt(ZERO))
    .map((b) => ({ ...b, balance: new Decimal(b.balance) }));

  const debtors = balances
    .filter((b) => b.balance.lt(ZERO))
    .map((b) => ({ ...b, balance: new Decimal(b.balance) }));

  while (creditors.length > 0 && debtors.length > 0) {
    // Sort largest absolute first
    creditors.sort((a, b) => b.balance.cmp(a.balance));
    debtors.sort((a, b) => a.balance.cmp(b.balance)); // most negative first

    const creditor = creditors[0]!;
    const debtor = debtors[0]!;

    const transferAmount = minDecimal(creditor.balance, debtor.balance.abs());

    transfers.push({
      fromUserId: debtor.userId,
      fromUserName: debtor.name,
      toUserId: creditor.userId,
      toUserName: creditor.name,
      amount: transferAmount,
    });

    creditor.balance = creditor.balance.sub(transferAmount);
    debtor.balance = debtor.balance.add(transferAmount);

    // Remove settled parties
    if (creditor.balance.isZero()) creditors.shift();
    if (debtor.balance.isZero()) debtors.shift();
  }

  return transfers;
}

/** Ensures a future closing can be persisted without hidden rounding residue. */
export function assertSettlementInvariants(
  balances: BalanceEntry[],
  transfers: SettlementTransfer[]
): void {
  const totalBalance = balances.reduce(
    (total, entry) => total.add(entry.balance),
    new Decimal(0)
  );
  const totalCredits = balances.reduce(
    (total, entry) => entry.balance.gt(0) ? total.add(entry.balance) : total,
    new Decimal(0)
  );
  const totalDebts = balances.reduce(
    (total, entry) => entry.balance.lt(0) ? total.add(entry.balance.abs()) : total,
    new Decimal(0)
  );
  const totalTransferred = transfers.reduce(
    (total, transfer) => total.add(transfer.amount),
    new Decimal(0)
  );
  const invalidTransfer = transfers.some(
    (transfer) => (
      transfer.amount.lte(0)
      || transfer.amount.decimalPlaces() > 2
      || transfer.fromUserId === transfer.toUserId
    )
  );
  const residuals = new Map(
    balances.map((entry) => [entry.userId, new Decimal(entry.balance)])
  );
  let unknownParticipant = false;
  for (const transfer of transfers) {
    const debtor = residuals.get(transfer.fromUserId);
    const creditor = residuals.get(transfer.toUserId);
    if (debtor === undefined || creditor === undefined) {
      unknownParticipant = true;
      continue;
    }
    residuals.set(transfer.fromUserId, debtor.add(transfer.amount));
    residuals.set(transfer.toUserId, creditor.sub(transfer.amount));
  }
  const hasResidual = [...residuals.values()].some((balance) => !balance.isZero());

  if (
    !totalBalance.isZero()
    || !totalCredits.eq(totalDebts)
    || !totalTransferred.eq(totalCredits)
    || invalidTransfer
    || unknownParticipant
    || hasResidual
  ) {
    throw new FinancialError(
      "SETTLEMENT_UNBALANCED",
      "Settlement balances do not reconcile exactly to whole paisa."
    );
  }
}

/**
 * Computes net balance for a single user.
 *
 * Formula:
 *   Net Balance =
 *     sum(BazarExpense.amount)
 *     + sum(MaidPayment.amount)
 *     + sum(FridgePayment.amount)
 *     + sum(BulkCycle.cost)
 *     - sum(MealRecord.meal_count × meal_rate)
 *     - sum(MaidCharge.amount)
 *     - sum(FridgeAllocation.amount)
 *     - sum(BulkAllocation.amount)
 */
export function computeNetBalance(params: {
  totalBazarSpend: Decimal;
  totalMaidPayments: Decimal;
  totalFridgePayments: Decimal;
  totalBulkPurchases: Decimal;
  totalMealCost: Decimal;   // meal_count × meal_rate already computed by caller
  totalMaidCharges: Decimal;
  totalFridgeBillShare: Decimal;
  totalBulkAllocations: Decimal;
}): Decimal {
  return params.totalBazarSpend
    .add(params.totalMaidPayments)
    .add(params.totalFridgePayments)
    .add(params.totalBulkPurchases)
    .sub(params.totalMealCost)
    .sub(params.totalMaidCharges)
    .sub(params.totalFridgeBillShare)
    .sub(params.totalBulkAllocations);
}
