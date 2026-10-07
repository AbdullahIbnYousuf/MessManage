import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ personal: vi.fn(), auth: vi.fn(), user: vi.fn(), markOne: vi.fn(), markAll: vi.fn(), subscribe: vi.fn(), unsubscribe: vi.fn() }));
vi.mock("@/lib/services/acting-identity", () => ({ requirePersonalAccount: mocks.personal }));
vi.mock("@/lib/session", () => ({ requireAuth: mocks.auth }));
vi.mock("@/lib/utils/debts-api", () => ({ requireDebtUser: mocks.user, debtErrorResponse: (error: Response) => error }));
vi.mock("@/lib/services/debts/notification-inbox", () => ({ markDebtNotificationRead: mocks.markOne, markAllDebtNotificationsRead: mocks.markAll }));
vi.mock("@/lib/db", () => ({ db: { pushSubscription: { upsert: mocks.subscribe, updateMany: mocks.unsubscribe } } }));
import { PATCH as markOne } from "@/app/api/notifications/[id]/read/route";
import { POST as markAll } from "@/app/api/notifications/read-all/route";
import { POST as subscribe, DELETE as unsubscribe } from "@/app/api/notifications/subscribe/route";

describe("acting-mode notification and device restrictions", () => {
  beforeEach(() => {
    vi.resetAllMocks(); mocks.auth.mockResolvedValue({ id: "member" }); mocks.user.mockResolvedValue({ id: "member" });
    mocks.personal.mockRejectedValue(Response.json({ code: "ACTING_ACTION_FORBIDDEN" }, { status: 403 }));
  });
  it("cannot mark one or all notifications read through direct API calls", async () => {
    const request = new Request("https://app.example/api/notifications/n/read", { method: "PATCH" });
    expect((await markOne(request, { params: Promise.resolve({ id: "n" }) })).status).toBe(403);
    expect((await markAll()).status).toBe(403);
    expect(mocks.markOne).not.toHaveBeenCalled(); expect(mocks.markAll).not.toHaveBeenCalled();
  });
  it("cannot register or disable any member's push device", async () => {
    const request = () => new Request("https://app.example/api/notifications/subscribe", { method: "POST", body: JSON.stringify({ endpoint: "https://push.example", keys: { p256dh: "key", auth: "secret" } }) });
    expect((await subscribe(request())).status).toBe(403); expect((await unsubscribe(request())).status).toBe(403);
    expect(mocks.subscribe).not.toHaveBeenCalled(); expect(mocks.unsubscribe).not.toHaveBeenCalled();
  });
});
