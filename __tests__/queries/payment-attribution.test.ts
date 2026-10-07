import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ actions: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { adminMemberAction: { findMany: mocks.actions } } }));
import { addPaymentAttribution } from "@/lib/queries/payment-attribution";

describe("public financial attribution", () => {
  beforeEach(() => vi.resetAllMocks());
  it("enriches each existing payment without leaking session tokens, reasons or snapshots", async () => {
    mocks.actions.mockResolvedValue([{ id: "audit", action: "payment.respond", entityIds: ["p"], createdAt: new Date("2026-10-07"),
      admin: { id: "admin", name: "Admin", nickname: null }, member: { id: "member", name: "Member", nickname: null },
      actingSession: { reason: "private reason", tokenHash: "private token" }, changes: [{ model: "transfer", after: [{ id: "p", status: "accepted" }] }] }]);
    const payment: Record<string, unknown> = { type: "payment", id: "p", amount: "123.45", initiatedBy: "sender" };
    const data = { recentActivity: [payment], paymentsNeedingResponse: [payment] };
    await addPaymentAttribution(data);
    expect(payment.amount).toBe("123.45"); expect(payment.initiatedBy).toBe("sender");
    expect(payment.onBehalfActions).toEqual([expect.objectContaining({ statusAfter: "accepted", admin: { id: "admin", name: "Admin" } })]);
    expect(JSON.stringify(payment)).not.toMatch(/private|tokenHash|changes/);
    expect(mocks.actions).toHaveBeenCalledWith(expect.objectContaining({ where: { entityType: "transfer", entityIds: { hasSome: ["p"] } } }));
  });
  it("does not query activity for a payload without payments", async () => {
    await addPaymentAttribution({ balance: "10.00" }); expect(mocks.actions).not.toHaveBeenCalled();
  });
});
