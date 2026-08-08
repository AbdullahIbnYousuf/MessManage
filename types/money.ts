import type {
  DebtLedgerEntry,
  DebtPaymentLedgerEntry,
  DebtSummaryPairwise,
} from "@/types/debts";

export type CurrentMoneyDirection = "owed" | "owes" | "balanced";
export type PreviousClosingStatus = "closed" | "ready" | "blocked" | "no_activity";

export type HouseholdMoneySummary = {
  generatedAt: string;
  currentMonth: {
    month: string;
    balance: string;
    direction: CurrentMoneyDirection;
    credits: string;
    costs: string;
    totalMeals: number;
    householdBazar: string;
    householdMeals: number;
    mealRate: string | null;
    hasData: boolean;
    breakdown: {
      bazarContributed: string;
      maidPayments: string;
      fridgePayments: string;
      bulkPurchases: string;
      mealCost: string;
      maidCharge: string;
      fridgeBillShare: string;
      bulkAllocations: string;
    };
  };
  previousClosing: {
    month: string;
    status: PreviousClosingStatus;
    settledAt: string | null;
    issues: string[];
  };
};

export type MoneySummary = HouseholdMoneySummary & {
  confirmedMoneyEnabled: boolean;
  confirmedMoney: {
    youOwe: string;
    owedToYou: string;
    net: string;
    pairwiseCount: number;
    pairwise: DebtSummaryPairwise[];
    pendingResponseCount: number;
    pendingInitiatedCount: number;
    pendingResponses: DebtPaymentLedgerEntry[];
    recentActivity: DebtLedgerEntry[];
  } | null;
};
