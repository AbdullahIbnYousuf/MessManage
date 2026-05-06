// ============================================================
// Firestore Helper Functions — All 14 Collections
// ============================================================

import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit, Timestamp, addDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type {
  User, MembershipRequest, MealPattern, MealRecord, MealEditRequest,
  BazarTrip, BazarExpense, BulkItem, BulkCycle, BulkAllocation,
  MaidCharge, MaidPayment, MonthlySettlement, SystemConfig,
} from '@/types';

// ===================== USERS =====================

export async function getUsers(): Promise<User[]> {
  const snap = await getDocs(collection(db, 'users'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as User));
}

export async function getActiveUsers(): Promise<User[]> {
  const q = query(collection(db, 'users'), where('status', '==', 'active'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as User));
}

export async function getUser(id: string): Promise<User | null> {
  const snap = await getDoc(doc(db, 'users', id));
  return snap.exists() ? { id: snap.id, ...snap.data() } as User : null;
}

export async function updateUser(id: string, data: Partial<User>): Promise<void> {
  await updateDoc(doc(db, 'users', id), data);
}

export async function createUser(id: string, data: Omit<User, 'id'>): Promise<void> {
  await setDoc(doc(db, 'users', id), data);
}

// ===================== MEMBERSHIP REQUESTS =====================

export async function getMembershipRequests(status?: MembershipRequest['status']): Promise<MembershipRequest[]> {
  let q;
  if (status) {
    q = query(collection(db, 'membershipRequests'), where('status', '==', status));
  } else {
    q = collection(db, 'membershipRequests');
  }
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as MembershipRequest));
}

export async function updateMembershipRequest(id: string, data: Partial<MembershipRequest>): Promise<void> {
  await updateDoc(doc(db, 'membershipRequests', id), data);
}

// ===================== MEAL PATTERNS =====================

export async function getMealPattern(userId: string): Promise<MealPattern | null> {
  const q = query(collection(db, 'mealPatterns'), where('user_id', '==', userId));
  const snap = await getDocs(q);
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() } as MealPattern;
}

export async function setMealPattern(userId: string, pattern: Omit<MealPattern, 'id'>): Promise<void> {
  const existing = await getMealPattern(userId);
  if (existing) {
    await updateDoc(doc(db, 'mealPatterns', existing.id), { ...pattern });
  } else {
    await addDoc(collection(db, 'mealPatterns'), pattern);
  }
}

// ===================== MEAL RECORDS =====================

export async function getMealRecords(userId: string, month: string): Promise<MealRecord[]> {
  const startDate = month; // e.g. "2024-11-01"
  const [y, m] = month.split('-').map(Number);
  const endDate = `${y}-${String(m + 1).padStart(2, '0')}-01`;
  const q = query(
    collection(db, 'mealRecords'),
    where('user_id', '==', userId),
    where('date', '>=', startDate),
    where('date', '<', m === 12 ? `${y + 1}-01-01` : endDate)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as MealRecord));
}

export async function getAllMealRecordsForMonth(month: string): Promise<MealRecord[]> {
  const [y, m] = month.split('-').map(Number);
  const endDate = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
  const q = query(
    collection(db, 'mealRecords'),
    where('date', '>=', month),
    where('date', '<', endDate)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as MealRecord));
}

export async function getMealRecordByDate(userId: string, date: string): Promise<MealRecord | null> {
  const q = query(
    collection(db, 'mealRecords'),
    where('user_id', '==', userId),
    where('date', '==', date)
  );
  const snap = await getDocs(q);
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() } as MealRecord;
}

export async function upsertMealRecord(userId: string, date: string, mealCount: number): Promise<void> {
  const existing = await getMealRecordByDate(userId, date);
  if (existing) {
    await updateDoc(doc(db, 'mealRecords', existing.id), { meal_count: mealCount });
  } else {
    await addDoc(collection(db, 'mealRecords'), {
      user_id: userId,
      date,
      meal_count: mealCount,
      is_locked: false,
    });
  }
}

export async function lockMealRecord(id: string): Promise<void> {
  await updateDoc(doc(db, 'mealRecords', id), { is_locked: true });
}

// ===================== MEAL EDIT REQUESTS =====================

export async function getMealEditRequests(status?: MealEditRequest['status']): Promise<MealEditRequest[]> {
  let q;
  if (status) {
    q = query(collection(db, 'mealEditRequests'), where('status', '==', status));
  } else {
    q = collection(db, 'mealEditRequests');
  }
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as MealEditRequest));
}

export async function createMealEditRequest(data: Omit<MealEditRequest, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'mealEditRequests'), data);
  return ref.id;
}

export async function updateMealEditRequest(id: string, data: Partial<MealEditRequest>): Promise<void> {
  await updateDoc(doc(db, 'mealEditRequests', id), data);
}

// ===================== BAZAR TRIPS =====================

export async function getActiveBazarTrip(): Promise<BazarTrip | null> {
  const q = query(collection(db, 'bazarTrips'), where('status', '==', 'open'), limit(1));
  const snap = await getDocs(q);
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() } as BazarTrip;
}

export async function createBazarTrip(data: Omit<BazarTrip, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'bazarTrips'), data);
  return ref.id;
}

export async function updateBazarTrip(id: string, data: Partial<BazarTrip>): Promise<void> {
  await updateDoc(doc(db, 'bazarTrips', id), data);
}

export async function getBazarTrips(): Promise<BazarTrip[]> {
  const snap = await getDocs(collection(db, 'bazarTrips'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as BazarTrip));
}

// ===================== BAZAR EXPENSES =====================

export async function getBazarExpenses(month?: string): Promise<BazarExpense[]> {
  let q;
  if (month) {
    const [y, m] = month.split('-').map(Number);
    const endDate = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
    q = query(
      collection(db, 'bazarExpenses'),
      where('date', '>=', month),
      where('date', '<', endDate)
    );
  } else {
    q = collection(db, 'bazarExpenses');
  }
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as BazarExpense));
}

export async function createBazarExpense(data: Omit<BazarExpense, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'bazarExpenses'), data);
  return ref.id;
}

export async function getUserBazarExpenses(userId: string): Promise<BazarExpense[]> {
  const q = query(collection(db, 'bazarExpenses'), where('user_id', '==', userId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as BazarExpense));
}

// ===================== BULK ITEMS =====================

export async function getBulkItems(): Promise<BulkItem[]> {
  const snap = await getDocs(collection(db, 'bulkItems'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as BulkItem));
}

export async function createBulkItem(data: Omit<BulkItem, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'bulkItems'), data);
  return ref.id;
}

// ===================== BULK CYCLES =====================

export async function getActiveBulkCycles(): Promise<BulkCycle[]> {
  const q = query(collection(db, 'bulkCycles'), where('status', '==', 'active'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as BulkCycle));
}

export async function getBulkCycles(itemId?: string): Promise<BulkCycle[]> {
  let q;
  if (itemId) {
    q = query(collection(db, 'bulkCycles'), where('bulk_item_id', '==', itemId));
  } else {
    q = collection(db, 'bulkCycles');
  }
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as BulkCycle));
}

export async function createBulkCycle(data: Omit<BulkCycle, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'bulkCycles'), data);
  return ref.id;
}

export async function updateBulkCycle(id: string, data: Partial<BulkCycle>): Promise<void> {
  await updateDoc(doc(db, 'bulkCycles', id), data);
}

// ===================== BULK ALLOCATIONS =====================

export async function getBulkAllocations(cycleId: string): Promise<BulkAllocation[]> {
  const q = query(collection(db, 'bulkAllocations'), where('cycle_id', '==', cycleId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as BulkAllocation));
}

export async function getUserBulkAllocations(userId: string, month?: string): Promise<BulkAllocation[]> {
  const q = query(collection(db, 'bulkAllocations'), where('user_id', '==', userId));
  const snap = await getDocs(q);
  let results = snap.docs.map(d => ({ id: d.id, ...d.data() } as BulkAllocation));
  if (month) {
    const [y, m] = month.split('-').map(Number);
    const endDate = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
    results = results.filter(a => a.allocated_at >= month && a.allocated_at < endDate);
  }
  return results;
}

export async function createBulkAllocation(data: Omit<BulkAllocation, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'bulkAllocations'), data);
  return ref.id;
}

// ===================== MAID CHARGES =====================

export async function getMaidCharges(month: string): Promise<MaidCharge[]> {
  const q = query(collection(db, 'maidCharges'), where('month', '==', month));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as MaidCharge));
}

export async function createMaidCharge(data: Omit<MaidCharge, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'maidCharges'), data);
  return ref.id;
}

export async function getUserMaidCharges(userId: string): Promise<MaidCharge[]> {
  const q = query(collection(db, 'maidCharges'), where('user_id', '==', userId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as MaidCharge));
}

// ===================== MAID PAYMENTS =====================

export async function getMaidPayments(month?: string): Promise<MaidPayment[]> {
  let q;
  if (month) {
    q = query(collection(db, 'maidPayments'), where('month', '==', month));
  } else {
    q = collection(db, 'maidPayments');
  }
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as MaidPayment));
}

export async function createMaidPayment(data: Omit<MaidPayment, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'maidPayments'), data);
  return ref.id;
}

export async function getUserMaidPayments(userId: string): Promise<MaidPayment[]> {
  const q = query(collection(db, 'maidPayments'), where('user_id', '==', userId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as MaidPayment));
}

// ===================== MONTHLY SETTLEMENTS =====================

export async function getMonthlySettlements(month: string): Promise<MonthlySettlement[]> {
  const q = query(collection(db, 'monthlySettlements'), where('month', '==', month));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as MonthlySettlement));
}

export async function createMonthlySettlement(data: Omit<MonthlySettlement, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'monthlySettlements'), data);
  return ref.id;
}

export async function isMonthSettled(month: string): Promise<boolean> {
  const q = query(collection(db, 'monthlySettlements'), where('month', '==', month), limit(1));
  const snap = await getDocs(q);
  return !snap.empty;
}

// ===================== SYSTEM CONFIG =====================

const CONFIG_DOC_ID = 'global';

export async function getSystemConfig(): Promise<SystemConfig | null> {
  const snap = await getDoc(doc(db, 'systemConfig', CONFIG_DOC_ID));
  return snap.exists() ? { id: snap.id, ...snap.data() } as SystemConfig : null;
}

export async function updateSystemConfig(data: Partial<SystemConfig>): Promise<void> {
  await setDoc(doc(db, 'systemConfig', CONFIG_DOC_ID), data, { merge: true });
}

export async function initSystemConfig(adminId: string): Promise<void> {
  const existing = await getSystemConfig();
  if (!existing) {
    await setDoc(doc(db, 'systemConfig', CONFIG_DOC_ID), {
      meal_deadline: '22:00',
      maid_charge_default: 700,
      active_trip_id: null,
      updated_at: new Date().toISOString(),
      updated_by: adminId,
    });
  }
}
