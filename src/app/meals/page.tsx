'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getMealRecords, upsertMealRecord, getSystemConfig } from '@/lib/firestore';
import { getCurrentMonth, getDatesInMonth, isDeadlinePassed, isPastDate, isToday, getToday } from '@/lib/calculations';
import type { MealRecord } from '@/types';
import { useToast } from '@/contexts/ToastContext';

export default function MealsPage() {
  const { appUser } = useAuth();
  const { toast } = useToast();
  const [currentMonth, setCurrentMonth] = useState(getCurrentMonth());
  const [records, setRecords] = useState<Record<string, MealRecord>>({});
  const [loading, setLoading] = useState(true);
  const [deadline, setDeadline] = useState('22:00');

  useEffect(() => {
    async function load() {
      if (!appUser) return;
      try {
        const config = await getSystemConfig();
        if (config) setDeadline(config.meal_deadline);

        const fetched = await getMealRecords(appUser.id, currentMonth);
        const recMap: Record<string, MealRecord> = {};
        fetched.forEach(r => { recMap[r.date] = r; });
        setRecords(recMap);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [appUser, currentMonth]);

  const handleMealChange = async (date: string, delta: number) => {
    if (!appUser) return;

    // Deadline Logic
    if (isPastDate(date)) {
      toast("Cannot edit past meals without admin permission.", 'error');
      return;
    }
    if (isToday(date) && isDeadlinePassed(deadline)) {
      toast(`Deadline of ${deadline} has passed for today. Request edit permission.`, 'error');
      return;
    }

    const currentCount = records[date]?.meal_count || 0;
    const newCount = Math.max(0, Math.min(3, currentCount + delta)); // restrict between 0 and 3 meals
    
    if (newCount === currentCount) return;

    // Optimistic update
    setRecords(prev => ({
      ...prev,
      [date]: { ...prev[date], date, meal_count: newCount, is_locked: false } as MealRecord
    }));

    try {
      await upsertMealRecord(appUser.id, date, newCount);
    } catch (e) {
      console.error('Failed to update meal', e);
      // Revert optimism if failed (simplified for now)
    }
  };

  if (loading) return <div className="page-loading"><div className="spinner"></div></div>;

  const [y, m] = currentMonth.split('-').map(Number);
  const dates = getDatesInMonth(y, m);
  const today = getToday();

  return (
    <div className="grid gap-20">
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">My Meal Calendar</h3>
          <span className="badge badge-warning">Deadline: {deadline}</span>
        </div>
        
        <p className="text-secondary mb-20">
          Click the + or - buttons on a day to adjust your meal count. Past days are locked.
        </p>

        <div className="calendar">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="calendar-header">{day}</div>
          ))}
          
          {/* Empty cells for start of month offset */}
          {Array.from({ length: new Date(y, m - 1, 1).getDay() }).map((_, i) => (
            <div key={`empty-${i}`} className="calendar-cell empty"></div>
          ))}

          {dates.map(date => {
            const isPast = isPastDate(date);
            const isCurrentToday = isToday(date);
            const deadlinePassed = isCurrentToday && isDeadlinePassed(deadline);
            const locked = isPast || deadlinePassed || records[date]?.is_locked;
            const count = records[date]?.meal_count || 0;
            const dayNum = new Date(date).getDate();

            return (
              <div key={date} className={`calendar-cell ${isCurrentToday ? 'today' : ''} ${locked ? 'locked' : ''}`}>
                <div className="calendar-day">{dayNum}</div>
                <div className={`calendar-meal-count ${count === 0 ? 'zero' : ''}`}>{count}</div>
                
                {!locked && (
                  <div className="flex gap-8 mt-8" style={{ position: 'absolute', bottom: '6px' }}>
                    <button onClick={() => handleMealChange(date, -1)} className="btn btn-icon btn-secondary" style={{ width: '24px', height: '24px', padding: 0 }}>-</button>
                    <button onClick={() => handleMealChange(date, 1)} className="btn btn-icon btn-secondary" style={{ width: '24px', height: '24px', padding: 0 }}>+</button>
                  </div>
                )}
                {locked && <div style={{ fontSize: '10px', color: 'var(--text-muted)', position: 'absolute', bottom: '6px' }}>Locked</div>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
