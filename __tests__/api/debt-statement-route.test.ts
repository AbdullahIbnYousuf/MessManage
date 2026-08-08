import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ session: vi.fn(), statement: vi.fn() }));
vi.mock("@/lib/session", () => ({ getSessionUser: mocks.session }));
vi.mock("@/lib/queries/debts", () => ({ fetchDebtMemberStatement: mocks.statement }));

import { GET } from "@/app/api/debts/members/[id]/statement/route";

const userId = "00000000-0000-4000-8000-000000000001";
const memberId = "00000000-0000-4000-8000-000000000002";

describe("GET /api/debts/members/[id]/statement", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.session.mockResolvedValue({ id: userId, status: "active", role: "member" });
    mocks.statement.mockResolvedValue({ position: "0.00" });
  });

  it("uses the authenticated member as the statement perspective", async () => {
    const response = await GET(new Request(`http://localhost/api/debts/members/${memberId}/statement?limit=10`), { params: Promise.resolve({ id: memberId }) });
    expect(response.status).toBe(200);
    expect(mocks.statement).toHaveBeenCalledWith({ currentUserId: userId, memberId, cursor: undefined, limit: 10 });
  });

  it("rejects an invalid member identifier before querying", async () => {
    const response = await GET(new Request("http://localhost/api/debts/members/nope/statement"), { params: Promise.resolve({ id: "nope" }) });
    expect(response.status).toBe(400);
    expect(mocks.statement).not.toHaveBeenCalled();
  });
});
