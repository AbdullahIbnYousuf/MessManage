import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import type { IdentityContext } from "@/types/acting";
const mocks = vi.hoisted(() => ({ transaction: vi.fn(), audited: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { $transaction: mocks.transaction } }));
vi.mock("@/lib/services/acting-transactions", () => ({ runAuditedTransaction: mocks.audited }));
import { withSerializableRetry } from "@/lib/services/debts/transactions";
import { actingOperations } from "@/lib/services/acting-context";

const admin = { id: "admin", email: "a@example.test", name: "Admin", role: "admin" as const, status: "active" as const, nickname: null, avatarUrl: null };
const member = { ...admin, id: "member", role: "member" as const };
const identity: IdentityContext = { actor: admin, effective: member, loginBinding: "login", cookiePresent: true, error: null,
  acting: { id: "session", admin, member, expiresAt: new Date(Date.now() + 1800000).toISOString() } };

describe("delegated serializable retries", () => {
  beforeEach(() => vi.resetAllMocks());
  it("delivers only committed audit notifications after a serialization retry", async () => {
    const scope = { identity, operation: "payment.create", notificationIds: [] as string[] };
    const conflict = new Prisma.PrismaClientKnownRequestError("retry", { code: "P2034", clientVersion: "test" });
    let attempts = 0;
    mocks.audited.mockImplementation(async (_tx, callback) => ({ result: await callback({}), notificationIds: [`notice-${++attempts}`] }));
    mocks.transaction.mockImplementation(async (callback) => { const result = await callback({}); if (attempts === 1) throw conflict; return result; });
    const result = await actingOperations.run(scope, () => withSerializableRetry(async () => "payment"));
    expect(result).toBe("payment"); expect(mocks.audited).toHaveBeenCalledTimes(2);
    expect(scope.notificationIds).toEqual(["notice-2"]);
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({ isolationLevel: "Serializable" }));
  });
  it("never publishes notification IDs when audit or commit fails", async () => {
    const scope = { identity, operation: "payment.create", notificationIds: [] as string[] };
    mocks.transaction.mockRejectedValue(new Error("audit rollback"));
    await expect(actingOperations.run(scope, () => withSerializableRetry(async () => "payment"))).rejects.toThrow("audit rollback");
    expect(scope.notificationIds).toEqual([]); expect(mocks.transaction).toHaveBeenCalledOnce();
  });
  it("bounds repeated database conflicts without publishing failed-attempt notices", async () => {
    const scope = { identity, operation: "payment.respond", notificationIds: [] as string[] };
    mocks.transaction.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("retry", { code: "P2034", clientVersion: "test" }));
    await expect(actingOperations.run(scope, () => withSerializableRetry(async () => "payment"))).rejects.toMatchObject({ code: "P2034" });
    expect(mocks.transaction).toHaveBeenCalledTimes(3); expect(scope.notificationIds).toEqual([]);
  });
});
