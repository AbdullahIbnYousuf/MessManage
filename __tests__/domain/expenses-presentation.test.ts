import { describe, expect, it } from "vitest";
import { buildExpenseReviewItems } from "@/components/domain/expenses/presentation";
import type { ExpensesSummary } from "@/types/expenses";

function summary(): ExpensesSummary {
  return {
    generatedAt: "2026-08-06T00:00:00.000Z",
    currentMonth: "2026-08",
    previousMonth: "2026-07",
    bulk: {
      itemCount: 1,
      activeCycleCount: 1,
      missingCycleCount: 0,
      activeCycles: [],
      missingItems: [],
    },
    maid: {
      month: "2026-08",
      status: "applied",
      chargeCount: 4,
      chargeTotal: "2800.00",
      paymentCount: 1,
      paymentTotal: "2800.00",
      defaultCharge: "700.00",
    },
    fridge: {
      month: "2026-07",
      status: "posted",
      billId: "bill",
      totalAmount: "400.00",
      paymentCount: 1,
      paymentTotal: "400.00",
      previousReading: "100.00",
      currentReading: "150.00",
      unitsUsed: "50.00",
      memberCount: 4,
    },
  };
}

describe("expense review presentation", () => {
  it("shows no review section when all expense areas are current", () => {
    expect(buildExpenseReviewItems(summary(), false)).toEqual([]);
  });

  it("uses optional admin wording for unapplied maid charges", () => {
    const data = summary();
    data.maid.status = "not_applied";

    expect(buildExpenseReviewItems(data, true)[0]).toMatchObject({
      id: "maid",
      title: "No maid charges applied",
      description: expect.stringContaining("optional"),
    });
    expect(buildExpenseReviewItems(data, false)[0]?.description).toContain(
      "currently remains"
    );
  });

  it("does not flag a fridge month already closed without a bill", () => {
    const data = summary();
    data.fridge = { ...data.fridge, status: "settled", billId: null };

    expect(buildExpenseReviewItems(data, false)).toEqual([]);
  });
});
