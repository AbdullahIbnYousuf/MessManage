/* eslint-disable @typescript-eslint/no-unused-vars -- request parameter preserves route signature in test stubs */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IdentityContext } from "@/types/acting";
const mocks = vi.hoisted(() => ({ identity: vi.fn(), deliver: vi.fn() }));
vi.mock("@/lib/services/acting-identity", () => ({ getIdentityContext: mocks.identity }));
vi.mock("@/lib/services/debts/notifications", () => ({ deliverDebtNotifications: mocks.deliver }));
import { withMemberRoute } from "@/lib/utils/acting-route";
import { actingOperations } from "@/lib/services/acting-context";

const admin = { id: "admin", name: "Admin", email: "a@example.com", nickname: null, avatarUrl: null, role: "admin" as const, status: "active" as const };
const member = { ...admin, id: "member", role: "member" as const };
const identity: IdentityContext = { actor: admin, effective: member, loginBinding: "login", cookiePresent: true, error: null,
  acting: { id: "session", admin, member, expiresAt: new Date(Date.now() + 1800000).toISOString() } };
function request(headers: Record<string, string> = {}) {
  return new Request("https://app.example/api/debts/payments", { method: "POST", headers: {
    cookie: `mm-acting=${"a".repeat(64)}`, origin: "https://app.example", "x-mm-context": "session", ...headers,
  } });
}

describe("explicit delegated route allowlist", () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.identity.mockResolvedValue(identity); });
  it("creates an isolated effective identity scope for audited operations", async () => {
    const handler = withMemberRoute("payment.create", async (_request: Request) => Response.json({ member: actingOperations.getStore()?.identity.effective?.id }));
    await expect((await handler(request())).json()).resolves.toEqual({ member: "member" });
    expect(actingOperations.getStore()).toBeUndefined();
  });
  it("rejects unlisted and unaudited operations before invoking the handler", async () => {
    const callback = vi.fn(async (_request: Request) => Response.json({ ok: true }));
    expect((await withMemberRoute("new.unaudited-operation", callback)(request())).status).toBe(403);
    expect(callback).not.toHaveBeenCalled();
  });
  it.each(["self", "old-session", ""])("rejects stale or missing browser context: %s", async (expected) => {
    const callback = vi.fn(async (_request: Request) => Response.json({ ok: true }));
    const response = await withMemberRoute("payment.create", callback)(request({ "x-mm-context": expected }));
    expect(response.status).toBe(409); expect(callback).not.toHaveBeenCalled();
  });
  it("denies cross-site actions even with the correct cookie and context", async () => {
    const callback = vi.fn(async (_request: Request) => Response.json({ ok: true }));
    expect((await withMemberRoute("payment.create", callback)(request({ origin: "https://evil.example" }))).status).toBe(403);
    expect(callback).not.toHaveBeenCalled();
  });
  it("rejects expired sessions without falling back to normal execution", async () => {
    mocks.identity.mockResolvedValue({ ...identity, error: { code: "ACTING_SESSION_EXPIRED", message: "expired" }, effective: null, acting: null });
    const callback = vi.fn(async (_request: Request) => Response.json({ ok: true }));
    expect((await withMemberRoute("payment.create", callback)(request())).status).toBe(409); expect(callback).not.toHaveBeenCalled();
  });
  it("retains ordinary API compatibility without requiring new headers", async () => {
    const callback = vi.fn(async (_request: Request) => Response.json({ ok: true }));
    expect((await withMemberRoute("payment.create", callback)(new Request("https://app.example/api", { method: "POST" }))).status).toBe(200);
    expect(mocks.identity).not.toHaveBeenCalled();
  });
  it("keeps after-commit push failure non-blocking", async () => {
    mocks.deliver.mockRejectedValue(new Error("push offline")); const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const handler = withMemberRoute("payment.create", async (_request: Request) => { actingOperations.getStore()!.notificationIds.push("committed-notice"); return Response.json({ ok: true }); });
    expect((await handler(request())).status).toBe(200); expect(mocks.deliver).toHaveBeenCalledWith(["committed-notice"]); log.mockRestore();
  });
});
