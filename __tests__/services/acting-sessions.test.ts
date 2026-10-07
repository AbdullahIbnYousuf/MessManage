import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IdentityContext } from "@/types/acting";
const mocks = vi.hoisted(() => ({
  retry: vi.fn(), push: vi.fn(), sessionFind: vi.fn(),
  tx: { $queryRaw: vi.fn(), user: { findUnique: vi.fn() }, adminActingSession: { findFirst: vi.fn(), create: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() },
    adminMemberAction: { create: vi.fn() }, debtNotification: { create: vi.fn() } },
}));
vi.mock("@/lib/services/acting-identity", () => ({ hashActingToken: (token: string) => `hash:${token}` }));
vi.mock("@/lib/services/debts/transactions", () => ({ withSerializableRetry: mocks.retry }));
vi.mock("@/lib/services/debts/notifications", () => ({ deliverDebtNotifications: mocks.push }));
vi.mock("@/lib/db", () => ({ db: { adminActingSession: { findUnique: mocks.sessionFind } } }));
import { startActing, endActing } from "@/lib/services/acting-sessions";

const admin = { id: "00000000-0000-4000-8000-000000000001", name: "Admin", email: "a@example.com", nickname: null, avatarUrl: null, role: "admin" as const, status: "active" as const };
const member = { ...admin, id: "00000000-0000-4000-8000-000000000002", name: "Member", role: "member" as const };
const context: IdentityContext = { actor: admin, effective: admin, loginBinding: "login", acting: null, cookiePresent: false, error: null };

describe("delegation start and exit", () => {
  beforeEach(() => {
    vi.resetAllMocks(); mocks.retry.mockImplementation((callback) => callback(mocks.tx));
    mocks.tx.user.findUnique.mockImplementation(({ where }) => Promise.resolve(where.id === admin.id ? admin : member));
    mocks.tx.adminActingSession.findFirst.mockResolvedValue(null);
    mocks.tx.adminActingSession.create.mockImplementation(({ data }) => Promise.resolve({ ...data, id: "session", startedAt: new Date() }));
    mocks.tx.adminMemberAction.create.mockResolvedValue({ id: "audit" }); mocks.tx.debtNotification.create.mockResolvedValue({ id: "notice" });
  });
  it("creates a 30-minute hashed-token session and access notice atomically", async () => {
    const before = Date.now(); const result = await startActing(context, member.id, "  Member has left  ");
    expect(result.token).toMatch(/^[a-f0-9]{64}$/);
    expect(new Date(result.expiresAt).getTime() - before).toBeGreaterThanOrEqual(1800000);
    expect(mocks.tx.adminActingSession.create).toHaveBeenCalledWith({ data: expect.objectContaining({ tokenHash: `hash:${result.token}`, reason: "Member has left", memberId: member.id, adminId: admin.id, loginBinding: "login" }) });
    expect(mocks.tx.adminMemberAction.create).toHaveBeenCalledOnce(); expect(mocks.tx.debtNotification.create).toHaveBeenCalledOnce();
    expect(mocks.push).toHaveBeenCalledWith(["notice"]);
  });
  it.each([
    { actor: { ...admin, role: "member" } }, { actor: { ...admin, status: "deactivated" } }, { actor: null },
    { loginBinding: null }, { cookiePresent: true },
  ])("blocks unavailable or non-admin starts: %j", async (override) => {
    await expect(startActing({ ...context, ...override } as IdentityContext, member.id, "Member left")).rejects.toThrow();
    expect(mocks.tx.adminActingSession.create).not.toHaveBeenCalled();
  });
  it("rejects self-access and unknown/inactive members", async () => {
    await expect(startActing(context, admin.id, "Test access")).rejects.toMatchObject({ code: "ACTING_SELF_FORBIDDEN" });
    mocks.tx.user.findUnique.mockImplementation(({ where }) => Promise.resolve(where.id === admin.id ? admin : { ...member, status: "deactivated" }));
    await expect(startActing(context, member.id, "Member left")).rejects.toMatchObject({ code: "ACTING_MEMBER_INACTIVE" });
    expect(mocks.tx.adminActingSession.create).not.toHaveBeenCalled();
  });
  it("rejects a concurrent second session for the same login", async () => {
    mocks.tx.adminActingSession.findFirst.mockResolvedValue({ id: "already-active" });
    await expect(startActing(context, member.id, "Member left")).rejects.toMatchObject({ code: "ACTING_ALREADY_ACTIVE" });
  });
  it("rechecks administrator privileges in the transaction", async () => {
    mocks.tx.user.findUnique.mockResolvedValue({ ...admin, role: "member" });
    await expect(startActing(context, member.id, "Member left")).rejects.toMatchObject({ code: "ACTING_FORBIDDEN" });
  });
  it("does not deliver access notifications when audit persistence fails", async () => {
    mocks.tx.adminMemberAction.create.mockRejectedValue(new Error("audit failed"));
    await expect(startActing(context, member.id, "Member left")).rejects.toThrow("audit failed"); expect(mocks.push).not.toHaveBeenCalled();
  });
  it("ends expired sessions idempotently using the real administrator", async () => {
    mocks.tx.adminActingSession.findUnique.mockResolvedValue({ id: "session", adminId: admin.id, memberId: member.id, loginBinding: "login", endedAt: null });
    mocks.tx.adminActingSession.updateMany.mockResolvedValue({ count: 1 });
    await endActing(context, "token"); expect(mocks.tx.adminMemberAction.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: "session.ended", adminId: admin.id, memberId: member.id }) });
    mocks.tx.adminActingSession.updateMany.mockResolvedValue({ count: 0 }); mocks.tx.adminMemberAction.create.mockClear();
    await endActing(context, "token"); expect(mocks.tx.adminMemberAction.create).not.toHaveBeenCalled();
  });
  it("cannot end another administrator's delegation", async () => {
    mocks.tx.adminActingSession.findUnique.mockResolvedValue({ adminId: "another-admin", loginBinding: "login", endedAt: null });
    await endActing(context, "token"); expect(mocks.tx.adminActingSession.updateMany).not.toHaveBeenCalled();
  });
});
