import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireAuth: vi.fn(), fetchSummary: vi.fn() }));

vi.mock("@/lib/session", () => ({ requireAuth: mocks.requireAuth }));
vi.mock("@/lib/queries/money", () => ({ fetchHouseholdMoneySummary: mocks.fetchSummary }));

import { GET } from "@/app/api/money/household-summary/route";

describe("GET /api/money/household-summary", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.requireAuth.mockResolvedValue({ id: "member" });
    mocks.fetchSummary.mockResolvedValue({ generatedAt: "2026-08-01T00:00:00.000Z" });
  });

  it("scopes the provisional summary to the authenticated member", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(mocks.fetchSummary).toHaveBeenCalledWith({ currentUserId: "member" });
  });

  it("returns the existing authentication response without querying", async () => {
    mocks.requireAuth.mockRejectedValue(Response.json({ error: "Account deactivated" }, { status: 403 }));
    const response = await GET();
    expect(response.status).toBe(403);
    expect(mocks.fetchSummary).not.toHaveBeenCalled();
  });
});
