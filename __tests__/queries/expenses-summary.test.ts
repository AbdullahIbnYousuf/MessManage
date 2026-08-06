import { describe, expect, it, vi } from "vitest";
import Decimal from "decimal.js";
import { fetchExpensesSummary } from "@/lib/queries/expenses";

function createClient(overrides?: {
  items?: unknown[];
  maidCharges?: { count: number; total: string | null };
  maidPayments?: { count: number; total: string | null };
  fridgeBill?: unknown;
  settlementRuns?: Date[];
  defaultCharge?: string | null;
}) {
  return {
    bulkItem: {
      findMany: vi.fn().mockResolvedValue(overrides?.items ?? []),
    },
    maidCharge: {
      aggregate: vi.fn().mockResolvedValue({
        _count: { _all: overrides?.maidCharges?.count ?? 0 },
        _sum: {
          amount: overrides?.maidCharges?.total
            ? new Decimal(overrides.maidCharges.total)
            : null,
        },
      }),
    },
    maidPayment: {
      aggregate: vi.fn().mockResolvedValue({
        _count: { _all: overrides?.maidPayments?.count ?? 0 },
        _sum: {
          amount: overrides?.maidPayments?.total
            ? new Decimal(overrides.maidPayments.total)
            : null,
        },
      }),
    },
    fridgeBill: {
      findUnique: vi.fn().mockResolvedValue(overrides?.fridgeBill ?? null),
    },
    monthlySettlementRun: {
      findMany: vi.fn().mockResolvedValue(
        (overrides?.settlementRuns ?? []).map((month) => ({ month }))
      ),
    },
    systemConfig: {
      findFirst: vi.fn().mockResolvedValue(
        overrides?.defaultCharge === null
          ? null
          : { maidChargeDefault: new Decimal(overrides?.defaultCharge ?? "700.00") }
      ),
    },
  };
}

describe("fetchExpensesSummary", () => {
  it("returns neutral zero states without inventing financial amounts", async () => {
    const client = createClient();
    const now = new Date("2026-08-06T06:00:00.000Z");

    await expect(fetchExpensesSummary(client as never, now)).resolves.toEqual({
      generatedAt: now.toISOString(),
      currentMonth: "2026-08",
      previousMonth: "2026-07",
      bulk: {
        itemCount: 0,
        activeCycleCount: 0,
        missingCycleCount: 0,
        activeCycles: [],
        missingItems: [],
      },
      maid: {
        month: "2026-08",
        status: "not_applied",
        chargeCount: 0,
        chargeTotal: "0.00",
        paymentCount: 0,
        paymentTotal: "0.00",
        defaultCharge: "700.00",
      },
      fridge: {
        month: "2026-07",
        status: "not_posted",
        billId: null,
        totalAmount: "0.00",
        paymentCount: 0,
        paymentTotal: "0.00",
        previousReading: null,
        currentReading: null,
        unitsUsed: null,
        memberCount: null,
      },
    });
  });

  it("summarizes mixed bulk cycles and exact monthly payment totals", async () => {
    const client = createClient({
      items: [
        {
          id: "rice",
          name: "Rice",
          unit: "kg",
          cycles: [{
            id: "cycle-1",
            cost: new Decimal("1720.25"),
            purchaseDate: new Date("2026-07-30T00:00:00.000Z"),
            startedAt: new Date("2026-08-01T00:00:00.000Z"),
            purchasedBy: {
              id: "member-1",
              name: "Mostafijur Rahman",
              nickname: "Mostafijur",
              avatarUrl: null,
            },
          }],
        },
        { id: "gas", name: "Gas", unit: "cylinder", cycles: [] },
      ],
      maidCharges: { count: 3, total: "2100.30" },
      maidPayments: { count: 42, total: "2100.30" },
      fridgeBill: {
        id: "bill-1",
        totalAmount: new Decimal("80.80"),
        memberCount: 4,
        previousReading: new Decimal("100.00"),
        currentReading: new Decimal("110.10"),
        payments: [
          { amount: new Decimal("0.10") },
          { amount: new Decimal("0.20") },
        ],
      },
    });

    const summary = await fetchExpensesSummary(
      client as never,
      new Date("2026-08-06T06:00:00.000Z")
    );

    expect(summary.bulk).toMatchObject({
      itemCount: 2,
      activeCycleCount: 1,
      missingCycleCount: 1,
      missingItems: [{ id: "gas", name: "Gas", unit: "cylinder" }],
    });
    expect(summary.bulk.activeCycles[0]).toMatchObject({
      itemName: "Rice",
      cost: "1720.25",
      daysActive: 5,
      purchasedBy: { name: "Mostafijur" },
    });
    expect(summary.maid).toMatchObject({
      status: "applied",
      chargeTotal: "2100.30",
      paymentCount: 42,
      paymentTotal: "2100.30",
    });
    expect(summary.fridge).toMatchObject({
      status: "posted",
      paymentTotal: "0.30",
      unitsUsed: "10.10",
    });
  });

  it("handles January boundaries and months closed with zero records", async () => {
    const client = createClient({
      settlementRuns: [
        new Date("2027-01-01T00:00:00.000Z"),
        new Date("2026-12-01T00:00:00.000Z"),
      ],
      defaultCharge: null,
    });

    const summary = await fetchExpensesSummary(
      client as never,
      new Date("2027-01-15T06:00:00.000Z")
    );

    expect(summary.currentMonth).toBe("2027-01");
    expect(summary.previousMonth).toBe("2026-12");
    expect(summary.maid.status).toBe("settled_zero");
    expect(summary.fridge).toMatchObject({ status: "settled", billId: null });
    expect(summary.maid.defaultCharge).toBe("700.00");
  });
});
