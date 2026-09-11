import type { ExpensesSummary } from "@/types/expenses";
import type {
  HomeAttentionItem,
  HomeMealState,
} from "@/types/home";
import type { MoneySummary } from "@/types/money";

export function getHomeMealState({
  hasRecord,
  isLocked,
  deadlinePassed,
  editRequestStatus,
}: {
  hasRecord: boolean;
  isLocked: boolean;
  deadlinePassed: boolean;
  editRequestStatus: "pending" | "approved" | "rejected" | "expired" | "invalidated" | null;
}): HomeMealState {
  if (!hasRecord) return "missing";
  if (isLocked) return "locked";
  if (!deadlinePassed) return "editable";
  if (editRequestStatus === "approved") return "request_approved";
  if (editRequestStatus === "pending") return "request_pending";
  if (editRequestStatus === "rejected") return "request_rejected";
  return "request_required";
}

export function buildHomeAttention({
  isAdmin,
  mealState,
  isAssignedToBazar,
  pendingMealEditCount,
  pendingMembershipCount,
  expenses,
  money,
}: {
  isAdmin: boolean;
  mealState: HomeMealState;
  isAssignedToBazar: boolean;
  pendingMealEditCount: number;
  pendingMembershipCount: number;
  expenses: ExpensesSummary;
  money: MoneySummary;
}): HomeAttentionItem[] {
  const items: HomeAttentionItem[] = [];

  if (mealState === "request_approved") {
    items.push({ kind: "meal_edit_approved", count: 1, href: "/meals" });
  }

  const paymentResponseCount = money.confirmedMoney?.pendingResponseCount ?? 0;
  if (paymentResponseCount > 0) {
    items.push({
      kind: "payment_response",
      count: paymentResponseCount,
      href: "/money",
    });
  }

  if (isAssignedToBazar) {
    items.push({ kind: "bazar_assignment", count: 1, href: "/bazar" });
  }

  if (!isAdmin) return items;

  if (pendingMealEditCount > 0) {
    items.push({
      kind: "admin_meal_edits",
      count: pendingMealEditCount,
      href: "/admin/meal-edit-requests",
    });
  }

  if (pendingMembershipCount > 0) {
    items.push({
      kind: "admin_memberships",
      count: pendingMembershipCount,
      href: "/admin/membership",
    });
  }

  if (money.previousClosing.status === "blocked") {
    items.push({
      kind: "closing_blocked",
      count: Math.max(1, money.previousClosing.issues.length),
      href: "/settlement",
    });
  } else if (money.previousClosing.status === "ready") {
    items.push({ kind: "closing_ready", count: 1, href: "/settlement" });
  }

  if (expenses.bulk.missingCycleCount > 0) {
    items.push({
      kind: "bulk_cycle_missing",
      count: expenses.bulk.missingCycleCount,
      href: "/bulk-items",
    });
  }

  if (expenses.fridge.status === "not_posted") {
    items.push({ kind: "fridge_bill_missing", count: 1, href: "/fridge" });
  }

  if (expenses.maid.status === "not_applied") {
    items.push({ kind: "maid_not_applied", count: 1, href: "/maid" });
  }

  return items;
}
