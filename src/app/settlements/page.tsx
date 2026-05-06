'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { 
  getBazarExpenses, getAllMealRecordsForMonth, getMaidCharges, 
  getMaidPayments, getUserBulkAllocations, getActiveUsers 
} from '@/lib/firestore';
import { 
  calculateMealRate, calculateUserBalance, calculateSmartSettlement, formatTaka, getCurrentMonth
} from '@/lib/calculations';
import type { UserBalance, SmartSettlementPlan, User } from '@/types';

export default function SettlementsPage() {
  const { appUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [balances, setBalances] = useState<UserBalance[]>([]);
  const [plan, setPlan] = useState<SmartSettlementPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(getCurrentMonth());

  useEffect(() => {
    loadData();
  }, [month]);

  async function loadData() {
    setLoading(true);
    try {
      const activeUsers = await getActiveUsers();
      setUsers(activeUsers);

      const [bazar, meals, maidCharges, maidPayments] = await Promise.all([
        getBazarExpenses(month),
        getAllMealRecordsForMonth(month),
        getMaidCharges(month),
        getMaidPayments(month)
      ]);

      const mealRateInfo = calculateMealRate(bazar, meals);
      
      const newBalances: UserBalance[] = [];
      for (const u of activeUsers) {
        const userBulk = await getUserBulkAllocations(u.id, month); // simplistic view for the month
        
        const bal = calculateUserBalance(
          u.id, u.name,
          bazar, maidPayments, mealRateInfo.meal_rate, 
          meals.filter(m => m.user_id === u.id),
          maidCharges.filter(c => c.user_id === u.id),
          userBulk
        );
        newBalances.push(bal);
      }

      setBalances(newBalances);
      setPlan(calculateSmartSettlement(newBalances));

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="page-loading"><div className="spinner"></div></div>;

  return (
    <div className="grid gap-20">
      
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Running Balances</h3>
          <span className="badge badge-neutral">Based on all entries for current month</span>
        </div>
        
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Member</th>
                <th className="text-right">Bazar Contrib</th>
                <th className="text-right">Meal Cost</th>
                <th className="text-right">Maid Cost</th>
                <th className="text-right">Net Balance</th>
              </tr>
            </thead>
            <tbody>
              {balances.map(b => (
                <tr key={b.user_id}>
                  <td>{b.user_name}</td>
                  <td className="text-right text-muted">{formatTaka(b.total_bazar_contribution)}</td>
                  <td className="text-right text-muted">{formatTaka(b.total_meal_cost)}</td>
                  <td className="text-right text-muted">{formatTaka(b.total_maid_charge)}</td>
                  <td className={`text-right font-bold ${b.net_balance > 0 ? 'balance-positive' : b.net_balance < 0 ? 'balance-negative' : 'balance-zero'}`}>
                    {b.net_balance > 0 ? '+' : ''}{formatTaka(b.net_balance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title flex items-center gap-8">
            <span>Smart Settlement Plan</span>
          </h3>
        </div>
        <p className="text-secondary mb-16">
          This is the mathematically optimal way to settle all debts with the fewest number of transactions.
        </p>

        {(!plan || plan.transfers.length === 0) ? (
          <div className="empty-state">
            <div className="empty-state-text">All balances are settled!</div>
          </div>
        ) : (
          <div>
            {plan.transfers.map((t, idx) => (
              <div key={idx} className="settlement-arrow">
                <div className="settlement-user" style={{ color: 'var(--negative)' }}>
                  {t.from_user_name}
                </div>
                <div className="text-muted" style={{ fontSize: '20px' }}>→</div>
                <div className="settlement-user" style={{ color: 'var(--positive)' }}>
                  {t.to_user_name}
                </div>
                <div style={{ flex: 1 }}></div>
                <div className="settlement-amount">
                  {formatTaka(t.amount)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
