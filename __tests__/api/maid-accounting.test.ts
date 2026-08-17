import { beforeEach, describe, expect, it, vi } from "vitest";
import Decimal from "decimal.js";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  requireAuth: vi.fn(),
  serializable: vi.fn(),
  assertMonthOpen: vi.fn(),
  chargeFindFirst: vi.fn(),
  configFindFirst: vi.fn(),
  userFindMany: vi.fn(),
  chargeCreateMany: vi.fn(),
  paymentCreate: vi.fn(),
}));

const tx = {
  maidCharge: {
    findFirst: mocks.chargeFindFirst,
    createMany: mocks.chargeCreateMany,
  },
  maidPayment: { create: mocks.paymentCreate },
  systemConfig: { findFirst: mocks.configFindFirst },
  user: { findMany: mocks.userFindMany },
};

vi.mock("@/lib/session", () => ({
  requireAdmin: mocks.requireAdmin,
  requireAuth: mocks.requireAuth,
}));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/services/debts/transactions", () => ({
  withSerializableRetry: mocks.serializable,
}));
vi.mock("@/lib/services/month-state", () => ({
  assertMonthOpen: mocks.assertMonthOpen,
}));

import { POST as applyMaidCharges } from "@/app/api/admin/maid/route";
import { POST as recordMaidPayment } from "@/app/api/maid/payment/route";

function jsonRequest(url: string, body: unknown) {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("next-month maid accounting", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.requireAdmin.mockResolvedValue({ id: "admin" });
    mocks.requireAuth.mockResolvedValue({ id: "payer" });
    mocks.assertMonthOpen.mockResolvedValue(undefined);
    mocks.chargeFindFirst.mockResolvedValue(null);
    mocks.configFindFirst.mockResolvedValue({ maidChargeDefault: new Decimal("700.00") });
    mocks.userFindMany.mockResolvedValue([
      { id: "july-member", joinedAt: new Date("2026-07-31T00:00:00.000Z"), deactivatedAt: null },
      { id: "august-member", joinedAt: new Date("2026-08-01T00:00:00.000Z"), deactivatedAt: null },
    ]);
    mocks.chargeCreateMany.mockResolvedValue({ count: 1 });
    mocks.paymentCreate.mockResolvedValue({
      id: "payment",
      amount: new Decimal("4200.00"),
      month: new Date("2026-08-01T00:00:00.000Z"),
      paidAt: new Date("2026-08-17T00:00:00.000Z"),
    });
    mocks.serializable.mockImplementation(
      (operation: (client: typeof tx) => Promise<unknown>) => operation(tx)
    );
  });

  it("charges July-active members inside August accounting", async () => {
    const response = await applyMaidCharges(jsonRequest(
      "http://localhost/api/admin/maid",
      { month: "2026-08" }
    ));

    expect(response.status).toBe(200);
    expect(mocks.assertMonthOpen).toHaveBeenCalledWith(tx, new Date("2026-08-01"));
    expect(mocks.chargeCreateMany).toHaveBeenCalledWith({
      data: [{
        userId: "july-member",
        amount: new Decimal("700.00"),
        month: new Date("2026-08-01"),
        serviceMonth: new Date("2026-07-01"),
        appliedAt: expect.any(Date),
      }],
    });
  });

  it("records the maid payment in the same deferred accounting period", async () => {
    const response = await recordMaidPayment(jsonRequest(
      "http://localhost/api/maid/payment",
      { month: "2026-08-01", amount: "4200.00", note: "July maid" }
    ));

    expect(response.status).toBe(201);
    expect(mocks.paymentCreate).toHaveBeenCalledWith({
      data: {
        paidById: "payer",
        amount: new Decimal("4200.00"),
        month: new Date("2026-08-01"),
        serviceMonth: new Date("2026-07-01"),
        note: "July maid",
        paidAt: expect.any(Date),
      },
    });
  });

  it("does not create new maid records in a pre-cutover accounting month", async () => {
    const response = await applyMaidCharges(jsonRequest(
      "http://localhost/api/admin/maid",
      { month: "2026-07" }
    ));

    expect(response.status).toBe(400);
    expect(mocks.serializable).not.toHaveBeenCalled();
  });
});
