import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  fetchSummary: vi.fn(),
}));

vi.mock("@/lib/session", () => ({ requireAuth: mocks.requireAuth }));
vi.mock("@/lib/queries/expenses", () => ({
  fetchExpensesSummary: mocks.fetchSummary,
}));

import { GET } from "@/app/api/expenses/summary/route";

describe("GET /api/expenses/summary", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.requireAuth.mockResolvedValue({ id: "member" });
    mocks.fetchSummary.mockResolvedValue({ currentMonth: "2026-08" });
  });

  it("returns the read-only summary for an authenticated member", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: { currentMonth: "2026-08" },
    });
    expect(mocks.fetchSummary).toHaveBeenCalledOnce();
  });

  it("returns the existing authentication response without querying expenses", async () => {
    mocks.requireAuth.mockRejectedValue(
      Response.json({ error: "Unauthorised" }, { status: 401 })
    );

    const response = await GET();

    expect(response.status).toBe(401);
    expect(mocks.fetchSummary).not.toHaveBeenCalled();
  });

  it("returns a generic error when a read fails", async () => {
    mocks.fetchSummary.mockRejectedValue(new Error("database unavailable"));

    const response = await GET();

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Something went wrong. Please try again.",
    });
  });
});
