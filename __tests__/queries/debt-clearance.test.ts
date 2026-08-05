import { describe, expect, it, vi } from "vitest";
import Decimal from "decimal.js";
import { fetchDebtClearance } from "@/lib/queries/debt-clearance";

describe("fetchDebtClearance", () => {
  it("returns exact gross totals and blocks unresolved positions", async () => {
    const client = {
      debtObligation: {
        findMany: vi.fn().mockResolvedValue([
          { debtorId: "member", creditorId: "a", amount: new Decimal("12.35") },
          { debtorId: "b", creditorId: "member", amount: new Decimal("4.10") },
        ]),
      },
      transfer: { findMany: vi.fn().mockResolvedValue([]) },
    };

    await expect(fetchDebtClearance(client as never, "member")).resolves.toEqual({
      youOwe: "12.35",
      owedToYou: "4.10",
      net: "-8.25",
      pendingCount: 0,
      canDeactivate: false,
    });
  });

  it("blocks a zero-balance member while a payment is pending", async () => {
    const client = {
      debtObligation: { findMany: vi.fn().mockResolvedValue([]) },
      transfer: {
        findMany: vi.fn().mockResolvedValue([
          { senderId: "member", receiverId: "a", amount: new Decimal("5.00"), status: "pending" },
        ]),
      },
    };

    await expect(fetchDebtClearance(client as never, "member")).resolves.toMatchObject({
      youOwe: "0.00",
      owedToYou: "0.00",
      pendingCount: 1,
      canDeactivate: false,
    });
  });

  it("allows a member with no balance and no pending payment", async () => {
    const client = {
      debtObligation: { findMany: vi.fn().mockResolvedValue([]) },
      transfer: { findMany: vi.fn().mockResolvedValue([]) },
    };

    await expect(fetchDebtClearance(client as never, "member")).resolves.toMatchObject({
      pendingCount: 0,
      canDeactivate: true,
    });
  });
});
