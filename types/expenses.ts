export type MaidExpenseStatus = "applied" | "not_applied" | "settled_zero";
export type FridgeExpenseStatus = "not_posted" | "posted" | "settled";

export type ExpensesSummary = {
  generatedAt: string;
  currentMonth: string;
  previousMonth: string;
  bulk: {
    itemCount: number;
    activeCycleCount: number;
    missingCycleCount: number;
    activeCycles: Array<{
      itemId: string;
      itemName: string;
      unit: string | null;
      cycleId: string;
      cost: string;
      purchaseDate: string;
      startedAt: string;
      daysActive: number;
      purchasedBy: {
        id: string;
        name: string;
        avatarUrl: string | null;
      };
    }>;
    missingItems: Array<{
      id: string;
      name: string;
      unit: string | null;
    }>;
  };
  maid: {
    month: string;
    status: MaidExpenseStatus;
    chargeCount: number;
    chargeTotal: string;
    paymentCount: number;
    paymentTotal: string;
    defaultCharge: string;
  };
  fridge: {
    month: string;
    status: FridgeExpenseStatus;
    billId: string | null;
    totalAmount: string;
    paymentCount: number;
    paymentTotal: string;
    previousReading: string | null;
    currentReading: string | null;
    unitsUsed: string | null;
    memberCount: number | null;
  };
};
