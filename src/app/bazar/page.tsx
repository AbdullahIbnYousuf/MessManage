'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { 
  getActiveBazarTrip, createBazarTrip, updateBazarTrip, 
  getBazarExpenses, createBazarExpense, getActiveUsers 
} from '@/lib/firestore';
import type { BazarTrip, User } from '@/types';
import { getToday } from '@/lib/calculations';
import { useToast } from '@/contexts/ToastContext';

export default function BazarPage() {
  const { appUser } = useAuth();
  const { toast } = useToast();
  const [activeTrip, setActiveTrip] = useState<BazarTrip | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Expense form state
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseNote, setExpenseNote] = useState('');
  const [shoppingNotes, setShoppingNotes] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [trip, activeUsers] = await Promise.all([
        getActiveBazarTrip(),
        getActiveUsers()
      ]);
      setActiveTrip(trip);
      setUsers(activeUsers);
      if (trip) setShoppingNotes(trip.shopping_notes || '');
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const handleTriggerTrip = async () => {
    if (!appUser) return;
    try {
      // In a real implementation, calculate lowest visits here based on BazarExpense aggregations
      const suggestion1 = users[0]?.id || null;
      const suggestion2 = users[1]?.id || null;

      const newTripId = await createBazarTrip({
        triggered_by: appUser.id,
        assignee_1: suggestion1,
        assignee_2: suggestion2,
        shopping_notes: '',
        status: 'open',
        triggered_at: new Date().toISOString(),
        completed_at: null
      });

      // Reload
      loadData();
    } catch (e) {
      console.error('Failed to trigger trip', e);
    }
  };

  const handleSaveNotes = async () => {
    if (!activeTrip) return;
    try {
      await updateBazarTrip(activeTrip.id, { shopping_notes: shoppingNotes });
      toast('Notes saved successfully!', 'success');
    } catch (e) {
      console.error('Failed to save notes', e);
    }
  };

  const handleSubmitExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appUser || !activeTrip) return;

    try {
      const amount = parseFloat(expenseAmount);
      if (isNaN(amount) || amount < 0) {
        toast('Invalid amount', 'error');
        return;
      }

      await createBazarExpense({
        user_id: appUser.id,
        trip_id: activeTrip.id,
        amount,
        note: expenseNote || null,
        date: getToday(),
        submitted_at: new Date().toISOString()
      });

      await updateBazarTrip(activeTrip.id, {
        status: 'completed',
        completed_at: new Date().toISOString(),
        shopping_notes: '' // Clears when completed
      });

      setExpenseAmount('');
      setExpenseNote('');
      loadData(); // reload will clear activeTrip
    } catch (e) {
      console.error('Failed to submit expense', e);
    }
  };

  if (loading) return <div className="page-loading"><div className="spinner"></div></div>;

  return (
    <div className="grid gap-20">
      
      {!activeTrip ? (
        <div className="card text-center" style={{ padding: '60px 20px' }}>
          <h3 className="card-title" style={{ fontSize: '20px' }}>No Active Bazar Trip</h3>
          <p className="text-secondary mb-24">
            Need something from the market? Trigger a new trip to let everyone know and start a shared shopping list.
          </p>
          <button onClick={handleTriggerTrip} className="btn btn-primary btn-lg">
            Trigger Bazar Trip
          </button>
        </div>
      ) : (
        <div className="grid grid-2">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Shared Shopping List</h3>
              <span className="badge badge-info">Open</span>
            </div>
            <div className="form-group">
              <textarea 
                className="form-textarea" 
                value={shoppingNotes}
                onChange={(e) => setShoppingNotes(e.target.value)}
                placeholder="Write items here... anyone can edit this."
                style={{ minHeight: '200px' }}
              />
            </div>
            <button onClick={handleSaveNotes} className="btn btn-secondary w-full">Save List</button>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Submit Bazar Expense</h3>
            </div>
            <p className="text-secondary mb-20" style={{ fontSize: '13px' }}>
              Did you go to the bazar? Enter what you spent to close this trip. (Enter 0 if you went but didn't buy anything).
            </p>
            <form onSubmit={handleSubmitExpense}>
              <div className="form-group">
                <label className="form-label">Amount Spent (৳)</label>
                <input 
                  type="number" 
                  className="form-input" 
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  min="0" step="0.01" required
                  placeholder="e.g. 1500"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Note (Optional)</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={expenseNote}
                  onChange={(e) => setExpenseNote(e.target.value)}
                  placeholder="e.g. Vegetables and fish"
                />
              </div>
              <button type="submit" className="btn btn-primary w-full mt-8">
                Submit Expense & Close Trip
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
