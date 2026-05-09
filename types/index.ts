// Shared TypeScript types.
// Enums come from Prisma — do not redefine them here.
// Import Prisma-generated enum types directly from @prisma/client where needed.

import type { Decimal } from "@prisma/client/runtime/library";

// ─── Session ──────────────────────────────────────────────────────────────────

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  role: "member" | "admin";
  status: "active" | "deactivated";
};

// ─── Derived / computed types (never stored in DB) ────────────────────────────

export type UserBalance = {
  userId: string;
  userName: string;
  avatarUrl: string | null;
  totalBazarContribution: Decimal;
  totalMaidPayment: Decimal;
  totalMealCost: Decimal;
  totalMaidCharge: Decimal;
  totalBulkAllocation: Decimal;
  netBalance: Decimal; // positive = owed money, negative = owes money
};

export type MealRateInfo = {
  month: string; // YYYY-MM-DD first day of month
  totalBazarSpending: Decimal;
  totalMeals: number;
  mealRate: Decimal;
};

export type SettlementTransfer = {
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  amount: Decimal;
};

export type SmartSettlementPlan = {
  transfers: SettlementTransfer[];
};

export type BazarLeaderboardEntry = {
  userId: string;
  userName: string;
  avatarUrl: string | null;
  visitCount: number;
  totalSpent: Decimal;
};

export type DayMealSummary = {
  userId: string;
  userName: string;
  avatarUrl: string | null;
  mealCount: number;
};

// ─── Next-Auth module augmentation ───────────────────────────────────────────
// Extends the default session/JWT types to include our custom fields.

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      avatarUrl: string | null;
      role: string;
      status: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    status?: string;
    avatarUrl?: string | null;
  }
}
