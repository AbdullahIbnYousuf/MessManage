'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getActiveBazarTrip, getBazarTrips, getBazarExpenses, getAllMealRecordsForMonth } from '@/lib/firestore';
import type { BazarTrip } from '@/types';
import { formatTaka } from '@/lib/calculations';

export default function DashboardPage() {
  const { appUser } = useAuth();
  const [activeTrip, setActiveTrip] = useState<BazarTrip | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const trip = await getActiveBazarTrip();
        setActiveTrip(trip);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) return <div className="page-loading"><div className="spinner"></div></div>;

  return (
    <div className="grid gap-20">
      
      {activeTrip && (
        <div className="card" style={{ borderColor: 'var(--accent)', background: 'rgba(6, 182, 212, 0.05)' }}>
          <div className="card-header">
            <h3 className="card-title flex items-center gap-8">
              <span>Active Bazar Trip</span>
            </h3>
            <span className="badge badge-info">Open</span>
          </div>
          <p className="text-secondary mb-16">
            A bazar trip is currently open. Feel free to add to the shopping list or complete the trip if you went.
          </p>
          <div className="shopping-list-box mb-16">
            <textarea 
              readOnly 
              value={activeTrip.shopping_notes || 'No items listed yet.'}
              placeholder="Shopping list is empty."
            />
          </div>
        </div>
      )}

      <div className="grid grid-2">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--accent-gradient)' }}>
            <span style={{ color: 'white' }}></span>
          </div>
          <div className="stat-label">My Current Balance</div>
          <div className="stat-value">৳0.00</div>
          <div className="stat-change text-muted mt-8">Settlements happen at month end</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.2)', color: 'var(--success)' }}>
            
          </div>
          <div className="stat-label">My Meals This Month</div>
          <div className="stat-value">0</div>
          <div className="stat-change text-muted mt-8">Based on calendar records</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Welcome to MealSync</h3>
        </div>
        <div style={{ color: 'var(--text-secondary)' }}>
          <p className="mb-16">
            Hello, {appUser?.name}! Welcome to the household management dashboard.
          </p>
          <p>
            Use the sidebar menu to navigate through meal planning, bazar tracking, and monthly settlements. The dashboard will populate with real data as you add meal records and bazar expenses.
          </p>
        </div>
      </div>
      
    </div>
  );
}
