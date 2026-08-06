import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  fetchSummary: vi.fn(),
}));

vi.mock("@/lib/session", () => ({ requireAuth: mocks.requireAuth }));
vi.mock("@/lib/queries/money", () => ({ fetchMoneySummary: mocks.fetchSummary }));

import { GET } from "@/app/api/money/summary/route";

describe("GET /api/money/summary", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.requireAuth.mockResolvedValue({ id: "member" });
    mocks.fetchSummary.mockResolvedValue({ currentMonth: { month: "2026-08" } });
    process.env.NEXT_PUBLIC_DEBTSYNC_ENABLED = "true";
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_DEBTSYNC_ENABLED;
  });

  it("scopes the summary to the authenticated member and current feature state", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(mocks.fetchSummary).toHaveBeenCalledWith({
      currentUserId: "member",
      confirmedMoneyEnabled: true,
    });
  });

  it("does not query money data when authentication fails", async () => {
    mocks.requireAuth.mockRejectedValue(
      Response.json({ error: "Account deactivated" }, { status: 403 })
    );

    const response = await GET();

    expect(response.status).toBe(403);
    expect(mocks.fetchSummary).not.toHaveBeenCalled();
  });

  it("returns a generic error for a read failure", async () => {
    mocks.fetchSummary.mockRejectedValue(new Error("database unavailable"));

    const response = await GET();

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Something went wrong. Please try again.",
    });
  });
});
