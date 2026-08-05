import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  list: vi.fn(),
  detail: vi.fn(),
  create: vi.fn(),
  respond: vi.fn(),
  cancel: vi.fn(),
}));

vi.mock("@/lib/session", () => ({ getSessionUser: mocks.session }));
vi.mock("@/lib/queries/debt-requests", () => ({
  fetchDebtRequests: mocks.list,
  fetchDebtRequestDetail: mocks.detail,
}));
vi.mock("@/lib/services/debts/requests", () => ({
  createDebtRequest: mocks.create,
  respondToDebtRequest: mocks.respond,
  cancelDebtRequest: mocks.cancel,
}));

import { GET as listRequests, POST as createRequest } from "@/app/api/debts/requests/route";
import { GET as requestDetail } from "@/app/api/debts/requests/[id]/route";
import { POST as respondRequest } from "@/app/api/debts/requests/[id]/respond/route";
import { POST as cancelRequest } from "@/app/api/debts/requests/[id]/cancel/route";

const userId = "00000000-0000-4000-8000-000000000001";
const debtorId = "00000000-0000-4000-8000-000000000002";
const requestId = "00000000-0000-4000-8000-000000000003";
const clientRequestId = "00000000-0000-4000-8000-000000000004";
const item = {
  id: requestId,
  amount: "20.00",
  description: "Shared purchase",
  status: "pending",
  rejectionReason: null,
  createdAt: "2026-08-05T00:00:00.000Z",
  respondedAt: null,
  cancelledAt: null,
  obligationId: null,
  requester: { id: userId, name: "Requester", avatarUrl: null },
  debtor: { id: debtorId, name: "Debtor", avatarUrl: null },
};

describe("Debt request API routes", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.DEBTSYNC_MUTATIONS_ENABLED = "true";
    mocks.session.mockResolvedValue({ id: userId, status: "active", role: "member" });
    mocks.list.mockResolvedValue({ requests: [item], nextCursor: null });
    mocks.detail.mockResolvedValue(item);
    mocks.create.mockResolvedValue({ request: item, created: true, notificationIds: [] });
    mocks.respond.mockResolvedValue({ request: { ...item, status: "accepted" }, created: false, notificationIds: [] });
    mocks.cancel.mockResolvedValue({ request: { ...item, status: "cancelled" }, created: false, notificationIds: [] });
  });

  afterEach(() => { delete process.env.DEBTSYNC_MUTATIONS_ENABLED; });

  it("scopes request listing and details to the authenticated participant", async () => {
    const listResponse = await listRequests(new Request("http://localhost/api/debts/requests?direction=incoming&status=pending"));
    expect(listResponse.status).toBe(200);
    expect(mocks.list).toHaveBeenCalledWith(expect.objectContaining({ userId, direction: "incoming", status: "pending" }));
    const detailResponse = await requestDetail(new Request("http://localhost"), { params: Promise.resolve({ id: requestId }) });
    expect(detailResponse.status).toBe(200);
    expect(mocks.detail).toHaveBeenCalledWith(userId, requestId);
  });

  it("uses the authenticated requester and ignores a client-supplied actor", async () => {
    const response = await createRequest(new Request("http://localhost/api/debts/requests", {
      method: "POST",
      body: JSON.stringify({ requesterId: "spoofed", debtorUserId: debtorId, amount: "20.00", description: "Shared purchase", clientRequestId }),
    }));
    expect(response.status).toBe(201);
    expect(mocks.create).toHaveBeenCalledWith(userId, { debtorUserId: debtorId, amount: "20.00", description: "Shared purchase", clientRequestId });
  });

  it("passes response and cancellation ownership only through the session", async () => {
    await respondRequest(new Request("http://localhost", { method: "POST", body: JSON.stringify({ actorId: "spoofed", decision: "accept" }) }), { params: Promise.resolve({ id: requestId }) });
    expect(mocks.respond).toHaveBeenCalledWith(userId, { requestId, decision: "accept", reason: undefined });
    await cancelRequest(new Request("http://localhost", { method: "POST" }), { params: Promise.resolve({ id: requestId }) });
    expect(mocks.cancel).toHaveBeenCalledWith(userId, requestId);
  });

  it("keeps reads available and blocks creation while mutations are disabled", async () => {
    process.env.DEBTSYNC_MUTATIONS_ENABLED = "false";
    expect((await listRequests(new Request("http://localhost/api/debts/requests"))).status).toBe(200);
    const response = await createRequest(new Request("http://localhost/api/debts/requests", { method: "POST", body: "{}" }));
    expect(response.status).toBe(503);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("does not reveal a non-participant request", async () => {
    mocks.detail.mockResolvedValue(null);
    const response = await requestDetail(new Request("http://localhost"), { params: Promise.resolve({ id: requestId }) });
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ code: "DEBT_REQUEST_NOT_FOUND" });
  });
});
