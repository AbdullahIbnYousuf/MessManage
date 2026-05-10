// Shared TypeScript types for the Meal Management system.
// Enums are defined in prisma/schema.prisma — do not duplicate them here.

// ─── Session ──────────────────────────────────────────────────────────────────

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  nickname: string | null;
  avatarUrl: string | null;
  role: "member" | "admin";
  status: "active" | "deactivated";
};

// ─── API Response Shapes ──────────────────────────────────────────────────────

export type ApiSuccess<T> = { data: T };
export type ApiError = { error: string };
export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// ─── Domain Types ─────────────────────────────────────────────────────────────

export type MemberSummary = {
  id: string;
  name: string;
  nickname: string | null;
  email: string;
  avatarUrl: string | null;
  role: "member" | "admin";
  status: "active" | "deactivated";
  joinedAt: string; // ISO string
};

export type MealPatternDay =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export type MealPattern = {
  monday: number;
  tuesday: number;
  wednesday: number;
  thursday: number;
  friday: number;
  saturday: number;
  sunday: number;
};

export type MealRecord = {
  id: string;
  date: string; // YYYY-MM-DD
  mealCount: number;
  isLocked: boolean;
};

export type BazarTrip = {
  id: string;
  status: "open" | "completed";
  triggeredAt: string;
  assignee1: MemberSummary | null;
  assignee2: MemberSummary | null;
  shoppingNotes: string | null;
};

export type BazarExpense = {
  id: string;
  userId: string;
  userName: string;
  amount: string; // Decimal as string
  note: string | null;
  date: string; // YYYY-MM-DD
  submittedAt: string;
};

export type BulkItem = {
  id: string;
  name: string;
  unit: string | null;
  activeCycle: BulkCycle | null;
};

export type BulkCycle = {
  id: string;
  bulkItemId: string;
  cost: string; // Decimal as string
  purchaseDate: string;
  status: "active" | "finished";
  startedAt: string;
  finishedAt: string | null;
  purchasedBy: MemberSummary;
};

export type NetBalance = {
  userId: string;
  userName: string;
  avatarUrl: string | null;
  balance: string; // Decimal as string — positive = owed money, negative = owes money
};

export type SettlementTransfer = {
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  amount: string; // Decimal as string
};

export type DashboardData = {
  todayMeals: Array<{ userId: string; name: string; nickname: string | null; avatarUrl: string | null; mealCount: number }>;
  todayTotal: number;
  activeTrip: BazarTrip | null;
  monthlyTotalBazar: string;
  monthlyTotalMeals: number;
  mealRate: string | null; // null if no meals yet
};
