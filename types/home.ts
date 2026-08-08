import type { MealEditRequestStatus } from "@prisma/client";
import type { CurrentMoneyDirection } from "@/types/money";

export type HomeMealState =
  | "missing"
  | "editable"
  | "request_required"
  | "request_pending"
  | "request_approved"
  | "request_rejected"
  | "locked";

export type HomeAttentionKind =
  | "meal_edit_approved"
  | "payment_response"
  | "bazar_assignment"
  | "admin_meal_edits"
  | "admin_memberships"
  | "closing_blocked"
  | "closing_ready"
  | "bulk_cycle_missing"
  | "fridge_bill_missing"
  | "maid_not_applied";

export type HomeAttentionItem = {
  kind: HomeAttentionKind;
  count: number;
  href: string;
};

export type HomeMealMember = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  mealCount: number | null;
  isLocked: boolean | null;
  hasRecord: boolean;
  isCurrentUser: boolean;
};

export type HomeActiveTrip = {
  id: string;
  status: "open";
  triggeredAt: string;
  shoppingNotes: string | null;
  isCurrentUserAssigned: boolean;
  assignee1: {
    id: string;
    name: string;
    avatarUrl: string | null;
  } | null;
  assignee2: {
    id: string;
    name: string;
    avatarUrl: string | null;
  } | null;
};

export type HomeSummary = {
  generatedAt: string;
  date: string;
  currentUser: {
    id: string;
    name: string;
  };
  meals: {
    deadline: string;
    deadlinePassed: boolean;
    total: number;
    missingRecordCount: number;
    members: HomeMealMember[];
    currentMember: HomeMealMember & {
      state: HomeMealState;
      editRequestStatus: MealEditRequestStatus | null;
    };
  };
  bazar: {
    activeTrip: HomeActiveTrip | null;
  };
  attention: HomeAttentionItem[];
  month: {
    month: string;
    provisionalBalance: string;
    direction: CurrentMoneyDirection;
    totalBazar: string;
    totalMeals: number;
    mealRate: string | null;
  };
};
