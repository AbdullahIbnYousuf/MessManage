import { describe, expect, it, vi } from "vitest";
import { FinancialError } from "@/lib/domain/financial-errors";
import { assertMonthOpen } from "@/lib/services/month-state";

describe("assertMonthOpen", () => {
  it("allows a month without a settlement run", async () => {
    const findUnique = vi.fn().mockResolvedValue(null);

    await expect(assertMonthOpen(
      { monthlySettlementRun: { findUnique } } as never,
      new Date("2026-07-01T00:00:00.000Z")
    )).resolves.toBeUndefined();
  });

  it("rejects a settled month with the stable error code", async () => {
    const findUnique = vi.fn().mockResolvedValue({ id: "settled-run" });

    await expect(assertMonthOpen(
      { monthlySettlementRun: { findUnique } } as never,
      new Date("2026-07-01T00:00:00.000Z")
    )).rejects.toMatchObject({
      code: "MONTH_SETTLED",
      status: 409,
    } satisfies Partial<FinancialError>);
  });
});
