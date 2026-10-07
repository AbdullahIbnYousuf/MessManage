import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), cookie: vi.fn(), headers: vi.fn(), findSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: mocks.cookie }), headers: async () => mocks.headers() }));
vi.mock("@/lib/db", () => ({ db: { adminActingSession: { findUnique: mocks.findSession } } }));
import { getIdentityContext, hashActingToken, requirePersonalAccount, assertIdentityRequest } from "@/lib/services/acting-identity";
import { getSessionUser, requireAdmin } from "@/lib/session";

const admin = { id: "admin", email: "admin@example.com", name: "Admin", nickname: null, avatarUrl: null, role: "admin", status: "active", loginBinding: "login" };
const member = { ...admin, id: "member", name: "Member", role: "admin" };
const session = { id: "delegation", adminId: "admin", memberId: "member", loginBinding: "login", endedAt: null, expiresAt: new Date(Date.now() + 1800000), admin, member };

describe("actor versus effective session identity", () => {
  beforeEach(() => {
    vi.resetAllMocks(); mocks.auth.mockResolvedValue({ user: admin }); mocks.headers.mockReturnValue(new Headers({ "x-mm-method": "GET" }));
    mocks.findSession.mockResolvedValue(session);
  });
  it("leaves ordinary sessions unchanged and makes no delegation query", async () => {
    expect((await getIdentityContext()).effective?.id).toBe("admin");
    expect(mocks.findSession).not.toHaveBeenCalled();
  });
  it("uses the member identity without inheriting their administrator permissions", async () => {
    mocks.cookie.mockReturnValue({ value: "a".repeat(64) });
    const context = await getIdentityContext();
    expect(context.actor?.id).toBe("admin"); expect(context.effective?.id).toBe("member"); expect(context.effective?.role).toBe("member");
    expect(mocks.findSession).toHaveBeenCalledWith(expect.objectContaining({ where: { tokenHash: hashActingToken("a".repeat(64)) } }));
    expect(mocks.auth.mock.results[0]?.value).resolves.toEqual({ user: admin });
    await expect(requireAdmin()).rejects.toMatchObject({ status: 403 });
  });
  it("blocks stale writes to an unwrapped/new endpoint", async () => {
    mocks.cookie.mockReturnValue({ value: "a".repeat(64) });
    mocks.headers.mockReturnValue(new Headers({ "x-mm-method": "POST", "x-mm-context": "delegation" }));
    await expect(getSessionUser()).rejects.toMatchObject({ status: 403 });
  });
  it("blocks stale context after delegation ends rather than writing as admin", async () => {
    mocks.headers.mockReturnValue(new Headers({ "x-mm-method": "POST", "x-mm-context": "delegation" }));
    await expect(assertIdentityRequest(await getIdentityContext())).rejects.toMatchObject({ status: 409 });
  });
  it("never falls back to administrator identity after expiry", async () => {
    mocks.cookie.mockReturnValue({ value: "a".repeat(64) });
    mocks.findSession.mockResolvedValue({ ...session, expiresAt: new Date(0) });
    expect((await getIdentityContext()).effective).toBeNull(); expect(await getSessionUser()).toBeNull();
  });
  it.each(["bad", "b".repeat(64)])("rejects unknown or malformed cookie %s", async (token) => {
    mocks.cookie.mockReturnValue({ value: token }); mocks.findSession.mockResolvedValue(null);
    expect((await getIdentityContext()).effective).toBeNull();
  });
  it("revokes access after logout/relogin changes the binding", async () => {
    mocks.cookie.mockReturnValue({ value: "a".repeat(64) }); mocks.auth.mockResolvedValue({ user: { ...admin, loginBinding: "new-login" } });
    expect((await getIdentityContext()).error?.code).toBe("ACTING_SESSION_INVALID");
  });
  it("rejects existing JWTs without a delegation binding", async () => {
    mocks.cookie.mockReturnValue({ value: "a".repeat(64) }); mocks.auth.mockResolvedValue({ user: { ...admin, loginBinding: undefined } });
    expect((await getIdentityContext()).effective).toBeNull();
  });
  it("fails closed when database verification is unavailable", async () => {
    mocks.cookie.mockReturnValue({ value: "a".repeat(64) }); mocks.findSession.mockRejectedValue(new Error("offline"));
    expect((await getIdentityContext()).error?.code).toBe("ACTING_SESSION_UNAVAILABLE");
  });
  it("blocks profile, payment-reference and device changes while acting", async () => {
    mocks.cookie.mockReturnValue({ value: "a".repeat(64) });
    await expect(requirePersonalAccount()).rejects.toMatchObject({ status: 403 });
  });
});
