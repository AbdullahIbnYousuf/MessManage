// ============================================================
// Smart Settlement Algorithm
// Minimises total transfers using creditor/debtor matching
// ============================================================

import type { UserBalance, SmartSettlementPlan } from '@/types';

/**
 * Smart Settlement: minimise the number of transactions to resolve all balances.
 * 
 * Algorithm:
 * 1. Identify all users with positive balances (creditors) and negative balances (debtors).
 * 2. Match the largest debtor with the largest creditor.
 * 3. Transfer the minimum amount needed to reduce one to zero.
 * 4. Repeat until all balances are resolved.
 * 5. Output a clean payment plan: who pays whom, and how much.
 */
export function calculateSmartSettlement(balances: UserBalance[]): SmartSettlementPlan {
  // Create mutable copies
  const creditors: { user_id: string; user_name: string; amount: number }[] = [];
  const debtors: { user_id: string; user_name: string; amount: number }[] = [];

  for (const b of balances) {
    if (b.net_balance > 0.01) {
      creditors.push({ user_id: b.user_id, user_name: b.user_name, amount: b.net_balance });
    } else if (b.net_balance < -0.01) {
      debtors.push({ user_id: b.user_id, user_name: b.user_name, amount: Math.abs(b.net_balance) });
    }
  }

  // Sort descending by amount
  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  const transfers: SmartSettlementPlan['transfers'] = [];

  let ci = 0;
  let di = 0;

  while (ci < creditors.length && di < debtors.length) {
    const creditor = creditors[ci];
    const debtor = debtors[di];

    const transferAmount = Math.min(creditor.amount, debtor.amount);

    if (transferAmount > 0.01) {
      transfers.push({
        from_user_id: debtor.user_id,
        from_user_name: debtor.user_name,
        to_user_id: creditor.user_id,
        to_user_name: creditor.user_name,
        amount: Math.round(transferAmount * 100) / 100,
      });
    }

    creditor.amount -= transferAmount;
    debtor.amount -= transferAmount;

    if (creditor.amount < 0.01) ci++;
    if (debtor.amount < 0.01) di++;
  }

  return { transfers };
}
