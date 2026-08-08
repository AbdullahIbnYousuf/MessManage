import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  fetchSummary: vi.fn(),
}));

vi.mock("@/lib/session", () => ({ requireAuth: mocks.requireAuth }));
vi.mock("@/lib/queries/home", () => ({ fetchHomeSummary: mocks.fetchSummary }));

import { GET } from "@/app/api/home/summary/route";

describe("GET /api/home/summary", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.requireAuth.mockResolvedValue({ id: "member", role: "member", status: "active" });
    mocks.fetchSummary.mockResolvedValue({ date: "2026-08-08" });
    process.env.NEXT_PUBLIC_DEBTSYNC_ENABLED = "true";
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_DEBTSYNC_ENABLED;
  });

  it("scopes the summary to the authenticated member and feature state", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(mocks.fetchSummary).toHaveBeenCalledWith({
      currentUser: { id: "member", role: "member", status: "active" },
      confirmedMoneyEnabled: true,
    });
    await expect(response.json()).resolves.toEqual({ data: { date: "2026-08-08" } });
  });

  it("does not perform summary reads after authentication failure", async () => {
    mocks.requireAuth.mockRejectedValue(
      Response.json({ error: "Account deactivated" }, { status: 403 })
    );

    const response = await GET();

    expect(response.status).toBe(403);
    expect(mocks.fetchSummary).not.toHaveBeenCalled();
  });

  it("returns a generic contained error when a read fails", async () => {
    mocks.fetchSummary.mockRejectedValue(new Error("database unavailable"));

    const response = await GET();

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Something went wrong. Please try again.",
    });
  });
});
