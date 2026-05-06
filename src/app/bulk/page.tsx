'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getActiveBulkCycles, createBulkCycle } from '@/lib/firestore';
import type { BulkCycle } from '@/types';
import { getToday } from '@/lib/calculations';

export default function BulkItemsPage() {
  const { appUser } = useAuth();
  const [activeCycles, setActiveCycles] = useState<BulkCycle[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [itemType, setItemType] = useState('gas_id_placeholder');
  const [cost, setCost] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(getToday());

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const cycles = await getActiveBulkCycles();
      setActiveCycles(cycles);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const handleStartCycle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appUser) return;
    
    try {
      await createBulkCycle({
        bulk_item_id: itemType, // In real app, look up from BulkItem collection
        purchased_by: appUser.id,
        cost: parseFloat(cost),
        purchase_date: purchaseDate,
        status: 'active',
        started_at: new Date().toISOString(),
        finished_at: null,
        finished_by: null
      });
      setCost('');
      loadData();
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) return <div className="page-loading"><div className="spinner"></div></div>;

  return (
    <div className="grid gap-20">
      
      <div className="grid grid-2">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Active Bulk Items</h3>
          </div>
          {activeCycles.length === 0 ? (
            <div className="text-secondary text-center py-20">No active gas or rice cycles.</div>
          ) : (
            <div className="flex flex-col gap-12">
              {activeCycles.map(c => (
                <div key={c.id} className="p-16 border rounded" style={{ borderColor: 'var(--border-glass)' }}>
                  <div className="flex justify-between items-center mb-8">
                    <strong style={{ textTransform: 'capitalize' }}>
                      {c.bulk_item_id === 'gas_id_placeholder' ? 'Gas Cylinder' : 'Rice Sack'}
                    </strong>
                    <span className="badge badge-info">Active</span>
                  </div>
                  <div className="text-sm text-muted">Cost: ৳{c.cost}</div>
                  <div className="text-sm text-muted">Started: {new Date(c.started_at).toLocaleDateString()}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Start New Cycle</h3>
          </div>
          <form onSubmit={handleStartCycle}>
            <div className="form-group">
              <label className="form-label">Item Type</label>
              <select className="form-select" value={itemType} onChange={e => setItemType(e.target.value)}>
                <option value="gas_id_placeholder">Gas Cylinder</option>
                <option value="rice_id_placeholder">Rice Sack</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Total Cost (৳)</label>
              <input type="number" className="form-input" value={cost} onChange={e => setCost(e.target.value)} required min="0" step="0.01" />
            </div>
            <div className="form-group">
              <label className="form-label">Purchase Date</label>
              <input type="date" className="form-input" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} required />
            </div>
            <button type="submit" className="btn btn-primary w-full mt-8">Start Cycle</button>
          </form>
        </div>
      </div>

    </div>
  );
}
