import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  serializable: vi.fn(),
}));

vi.mock("@/lib/session", () => ({ requireAuth: mocks.auth }));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/services/debts/transactions", () => ({
  withSerializableRetry: mocks.serializable,
}));

import { POST as submitBazarExpense } from "@/app/api/bazar/expense/route";
import { POST as startBulkCycle } from "@/app/api/bulk-items/[id]/cycle/route";

function uniqueConflict(target: string[]) {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint", {
    code: "P2002",
    clientVersion: "6.19.3",
    meta: { target },
  });
}

describe("financial concurrency conflict mapping", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.auth.mockResolvedValue({ id: "member", role: "member" });
  });

  it("maps a concurrent bazar submission to the stable trip-completed conflict", async () => {
    mocks.serializable.mockRejectedValue(uniqueConflict(["trip_id"]));
    const response = await submitBazarExpense(new Request(
      "http://localhost/api/bazar/expense",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amount: "100.00", date: "2026-08-09" }),
      }
    ));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: "BAZAR_TRIP_ALREADY_COMPLETED",
    });
  });

  it("maps a concurrent bulk start to the stable active-cycle conflict", async () => {
    mocks.serializable.mockRejectedValue(uniqueConflict(["bulk_item_id"]));
    const response = await startBulkCycle(
      new Request("http://localhost/api/bulk-items/item/cycle", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cost: "1200.00" }),
      }),
      { params: Promise.resolve({ id: "item" }) }
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: "BULK_CYCLE_ALREADY_ACTIVE",
    });
  });
});
