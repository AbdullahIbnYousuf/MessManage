import { beforeEach, describe, expect, it, vi } from "vitest";
import Decimal from "decimal.js";
import type { Prisma } from "@prisma/client";
import { runAuditedTransaction } from "@/lib/services/acting-transactions";
import { actingOperations } from "@/lib/services/acting-context";
import type { IdentityContext } from "@/types/acting";

const admin = { id: "admin", email: "a@example.com", name: "Admin", nickname: null, avatarUrl: null, role: "admin" as const, status: "active" as const };
const member = { ...admin, id: "member", name: "Member", role: "member" as const };
const identity: IdentityContext = { actor: admin, effective: member, cookiePresent: true, loginBinding: "login", error: null,
  acting: { id: "session", admin, member, expiresAt: new Date(Date.now() + 1800000).toISOString() } };
const session = { id: "session", adminId: "admin", memberId: "member", loginBinding: "login", endedAt: null, expiresAt: new Date(Date.now() + 1800000), admin, member };
const tx = {
  adminActingSession: { findUnique: vi.fn() }, $queryRaw: vi.fn(), $executeRaw: vi.fn(),
  transfer: { create: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
  mealRecord: { createMany: vi.fn(), findMany: vi.fn() },
  user: { update: vi.fn() },
  adminMemberAction: { create: vi.fn() }, debtNotification: { create: vi.fn() },
};
const client = tx as unknown as Prisma.TransactionClient;
const run = <T>(operation: (value: Prisma.TransactionClient) => Promise<T>) => actingOperations.run({ identity, operation: "payment.create", notificationIds: [] }, () => runAuditedTransaction(client, operation));

describe("transactional delegated audit", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    tx.adminActingSession.findUnique.mockResolvedValue(session);
    tx.$queryRaw.mockResolvedValue([]);
    tx.adminMemberAction.create.mockResolvedValue({ id: "audit" });
    tx.debtNotification.create.mockResolvedValue({ id: "notice" });
    tx.transfer.create.mockResolvedValue({ id: "payment", senderId: "member", receiverId: "other", initiatedById: "member", amount: new Decimal("10.25"), status: "pending" });
  });
  it("writes attribution and participant notifications through the same transaction client", async () => {
    const result = await run((value) => value.transfer.create({ data: { senderId: "member", receiverId: "other", initiatedById: "member", amount: new Decimal("10.25"), source: "direct", clientRequestId: "request" } }));
    expect(result.result.initiatedById).toBe("member");
    expect(tx.adminMemberAction.create).toHaveBeenCalledWith({ data: expect.objectContaining({ adminId: "admin", memberId: "member", entityType: "transfer", entityIds: ["payment"], changes: [expect.objectContaining({ after: [expect.objectContaining({ amount: "10.25" })] })] }) });
    expect(tx.debtNotification.create).toHaveBeenCalledTimes(2);
    expect(tx.debtNotification.create.mock.calls.map(([input]) => input.data.userId)).toEqual(["member", "other"]);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
  });
  it("rejects a revoked session before any financial write", async () => {
    tx.adminActingSession.findUnique.mockResolvedValue({ ...session, endedAt: new Date() });
    await expect(run((value) => value.transfer.create({ data: {} } as never))).rejects.toMatchObject({ code: "ACTING_SESSION_INVALID" });
    expect(tx.transfer.create).not.toHaveBeenCalled();
  });
  it("rejects inactive or demoted participants inside the transaction", async () => {
    for (const override of [{ admin: { ...admin, role: "member" } }, { admin: { ...admin, status: "deactivated" } }, { member: { ...member, status: "deactivated" } }]) {
      tx.adminActingSession.findUnique.mockResolvedValue({ ...session, ...override });
      await expect(run((value) => value.transfer.create({ data: {} } as never))).rejects.toThrow();
    }
    expect(tx.transfer.create).not.toHaveBeenCalled();
  });
  it("propagates audit failure to abort the transaction, without creating notifications", async () => {
    tx.adminMemberAction.create.mockRejectedValue(new Error("audit unavailable"));
    await expect(run((value) => value.transfer.create({ data: {} } as never))).rejects.toThrow("audit unavailable");
    expect(tx.debtNotification.create).not.toHaveBeenCalled();
  });
  it("propagates notification persistence failure to abort the transaction", async () => {
    tx.debtNotification.create.mockRejectedValue(new Error("notice unavailable"));
    await expect(run((value) => value.transfer.create({ data: {} } as never))).rejects.toThrow("notice unavailable");
  });
  it("does not audit a read-only or idempotently replayed transaction", async () => {
    await run(async () => "existing-payment");
    expect(tx.adminMemberAction.create).not.toHaveBeenCalled();
    expect(tx.debtNotification.create).not.toHaveBeenCalled();
  });
  it("blocks writes that have not been added to the auditable model allowlist", async () => {
    await expect(run((value) => value.user.update({ where: { id: "member" }, data: { bankName: "Changed" } }))).rejects.toMatchObject({ code: "ACTING_ACTION_FORBIDDEN" });
    expect(tx.user.update).not.toHaveBeenCalled();
  });
  it("blocks raw mutations that cannot be attributed", async () => {
    await expect(run((value) => value.$executeRaw`UPDATE "User" SET "name" = 'Changed'`)).rejects.toMatchObject({ code: "ACTING_ACTION_FORBIDDEN" });
    expect(tx.$executeRaw).not.toHaveBeenCalled();
  });
  it("audits meal-record generation even though it is initiated by a GET", async () => {
    tx.mealRecord.createMany.mockResolvedValue({ count: 1 });
    tx.mealRecord.findMany.mockResolvedValue([{ id: "meal", userId: "member", mealCount: 2, date: new Date("2026-11-01") }]);
    await actingOperations.run({ identity, operation: "meal.records", notificationIds: [] }, () => runAuditedTransaction(client, (value) => value.mealRecord.createMany({ data: [{ userId: "member", mealCount: 2, date: new Date("2026-11-01") }] })));
    expect(tx.adminMemberAction.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: "meal.records", entityType: "mealRecord", entityIds: ["meal"] }) });
  });
  it("ordinary transactions retain their original behavior", async () => {
    await runAuditedTransaction(client, async () => "ordinary");
    expect(tx.adminActingSession.findUnique).not.toHaveBeenCalled();
    expect(tx.adminMemberAction.create).not.toHaveBeenCalled();
  });
  it("captures exact before/after response transitions without altering amounts", async () => {
    const row = { id: "payment", senderId: "other", receiverId: "member", amount: new Decimal("100.01"), status: "pending" };
    tx.transfer.findMany.mockResolvedValueOnce([row]).mockResolvedValueOnce([{ ...row, status: "accepted" }]);
    tx.transfer.updateMany.mockResolvedValue({ count: 1 });
    await run((value) => value.transfer.updateMany({ where: { id: "payment", status: "pending" }, data: { status: "accepted" } }));
    expect(tx.adminMemberAction.create).toHaveBeenCalledWith({ data: expect.objectContaining({ changes: [expect.objectContaining({ before: [expect.objectContaining({ status: "pending", amount: "100.01" })], after: [expect.objectContaining({ status: "accepted", amount: "100.01" })] })] }) });
  });
});
