// ============================================================
// Shared Meal & Expense Management System
// TypeScript Type Definitions — All 14 Entities (Data Model v1.1)
// ============================================================

// --- Enums ---

export type UserRole = 'member' | 'admin';
export type UserStatus = 'active' | 'deactivated';
export type MembershipRequestStatus = 'pending' | 'approved' | 'rejected';
export type BazarTripStatus = 'open' | 'completed';
export type BulkCycleStatus = 'active' | 'finished';
export type MealEditRequestStatus = 'pending' | 'approved' | 'rejected';

// --- 1. User ---

export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  role: UserRole;
  status: UserStatus;
  joined_at: string; // ISO timestamp
  deactivated_at: string | null;
  phone_number: string | null;
  phone_number_2: string | null;
  bkash_number: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relation: string | null;
}

// --- 2. MembershipRequest ---

export interface MembershipRequest {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  status: MembershipRequestStatus;
  requested_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null; // User ID
  user_id: string | null; // Populated only when approved
}

// --- 3. MealPattern ---

export interface MealPattern {
  id: string;
  user_id: string;
  monday: number;
  tuesday: number;
  wednesday: number;
  thursday: number;
  friday: number;
  saturday: number;
  sunday: number;
  updated_at: string;
}

// --- 4. MealRecord ---

export interface MealRecord {
  id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  meal_count: number;
  is_locked: boolean;
}

// --- 5. MealEditRequest ---

export interface MealEditRequest {
  id: string;
  user_id: string;
  meal_record_id: string;
  status: MealEditRequestStatus;
  requested_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
}

// --- 6. BazarTrip ---

export interface BazarTrip {
  id: string;
  triggered_by: string;
  assignee_1: string | null;
  assignee_2: string | null;
  shopping_notes: string | null;
  status: BazarTripStatus;
  triggered_at: string;
  completed_at: string | null;
}

// --- 7. BazarExpense ---

export interface BazarExpense {
  id: string;
  user_id: string;
  trip_id: string;
  amount: number; // Decimal in taka
  note: string | null;
  date: string; // YYYY-MM-DD
  submitted_at: string;
}

// --- 8. BulkItem ---

export interface BulkItem {
  id: string;
  name: string;
  unit: string | null;
  created_at: string;
}

// --- 9. BulkCycle ---

export interface BulkCycle {
  id: string;
  bulk_item_id: string;
  purchased_by: string;
  cost: number;
  purchase_date: string; // YYYY-MM-DD
  status: BulkCycleStatus;
  started_at: string;
  finished_at: string | null;
  finished_by: string | null;
}

// --- 10. BulkAllocation ---

export interface BulkAllocation {
  id: string;
  cycle_id: string;
  user_id: string;
  meals_during_cycle: number;
  amount: number;
  allocated_at: string;
}

// --- 11. MaidCharge ---

export interface MaidCharge {
  id: string;
  user_id: string;
  amount: number;
  month: string; // YYYY-MM-DD (first day of month)
  applied_at: string;
}

// --- 12. MaidPayment ---

export interface MaidPayment {
  id: string;
  paid_by: string;
  amount: number;
  month: string; // YYYY-MM-DD (first day of month)
  note: string | null;
  paid_at: string;
}

// --- 13. MonthlySettlement ---

export interface MonthlySettlement {
  id: string;
  month: string; // YYYY-MM-DD (first day of month)
  from_user_id: string;
  to_user_id: string;
  amount: number;
  settled_at: string;
}

// --- 14. SystemConfig ---

export interface SystemConfig {
  id: string;
  meal_deadline: string; // Time string e.g. "22:00"
  maid_charge_default: number;
  active_trip_id: string | null;
  updated_at: string;
  updated_by: string | null;
}

// --- Derived / Computed Types (never stored) ---

export interface UserBalance {
  user_id: string;
  user_name: string;
  total_bazar_contribution: number;
  total_maid_payment: number;
  total_meal_cost: number;
  total_maid_charge: number;
  total_bulk_allocation: number;
  net_balance: number; // positive = owed money, negative = owes money
}

export interface MealRateInfo {
  month: string;
  total_bazar_spending: number;
  total_meals: number;
  meal_rate: number;
}

export interface SmartSettlementPlan {
  transfers: {
    from_user_id: string;
    from_user_name: string;
    to_user_id: string;
    to_user_name: string;
    amount: number;
  }[];
}

export interface BazarLeaderboardEntry {
  user_id: string;
  user_name: string;
  avatar_url: string | null;
  visit_count: number;
  total_spent: number;
}

export interface DayMealSummary {
  user_id: string;
  user_name: string;
  avatar_url: string | null;
  meal_count: number;
}
