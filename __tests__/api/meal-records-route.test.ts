import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  historical: vi.fn(),
  rolling: vi.fn(),
}));

vi.mock("@/lib/session", () => ({ requireAuth: mocks.auth }));
vi.mock("@/lib/queries/meal-records", () => ({
  fetchOrCreateMealRecordsForMonth: mocks.historical,
  fetchRollingMealRecords: mocks.rolling,
}));
vi.mock("@/lib/utils/dates", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/utils/dates")>();
  return {
    ...actual,
    getNow: () => new Date("2026-08-17T06:00:00.000Z"),
  };
});

import { GET } from "@/app/api/meals/records/route";

describe("member meal calendar month range", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.auth.mockResolvedValue({ id: "member" });
    mocks.historical.mockResolvedValue([]);
    mocks.rolling.mockResolvedValue([]);
  });

  it("loads historical months without rolling materialization", async () => {
    const response = await GET(
      new Request("http://localhost/api/meals/records?year=2026&month=7")
    );

    expect(response.status).toBe(200);
    expect(mocks.historical).toHaveBeenCalledWith("member", 2026, 7);
    expect(mocks.rolling).not.toHaveBeenCalled();
  });

  it("uses the rolling window for the current and next month", async () => {
    const currentResponse = await GET(
      new Request("http://localhost/api/meals/records?year=2026&month=8")
    );
    const nextResponse = await GET(
      new Request("http://localhost/api/meals/records?year=2026&month=9")
    );

    expect(currentResponse.status).toBe(200);
    expect(nextResponse.status).toBe(200);
    expect(mocks.rolling).toHaveBeenNthCalledWith(1, "member", 2026, 8);
    expect(mocks.rolling).toHaveBeenNthCalledWith(2, "member", 2026, 9);
  });

  it("rejects scheduling beyond next month", async () => {
    const response = await GET(
      new Request("http://localhost/api/meals/records?year=2026&month=10")
    );
    const json = await response.json() as { error: string };

    expect(response.status).toBe(400);
    expect(json.error).toContain("through next month");
    expect(mocks.historical).not.toHaveBeenCalled();
    expect(mocks.rolling).not.toHaveBeenCalled();
  });
});
