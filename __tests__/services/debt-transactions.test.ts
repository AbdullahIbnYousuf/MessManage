import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ transaction: vi.fn() }));

vi.mock("@/lib/db", () => ({
  db: { $transaction: mocks.transaction },
}));

import { withSerializableRetry } from "@/lib/services/debts/transactions";

function retryableError() {
  return new Prisma.PrismaClientKnownRequestError("Write conflict", {
    code: "P2034",
    clientVersion: "6.19.3",
  });
}

describe("withSerializableRetry", () => {
  beforeEach(() => vi.resetAllMocks());

  it("uses serializable isolation and retries a bounded write conflict", async () => {
    mocks.transaction
      .mockRejectedValueOnce(retryableError())
      .mockResolvedValueOnce("completed");

    await expect(withSerializableRetry(async () => "completed"))
      .resolves.toBe("completed");
    expect(mocks.transaction).toHaveBeenCalledTimes(2);
    expect(mocks.transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ isolationLevel: "Serializable" })
    );
  });

  it("stops after three serialization failures", async () => {
    mocks.transaction.mockRejectedValue(retryableError());
    await expect(withSerializableRetry(async () => "never"))
      .rejects.toMatchObject({ code: "P2034" });
    expect(mocks.transaction).toHaveBeenCalledTimes(3);
  });

  it("does not retry non-serialization errors", async () => {
    mocks.transaction.mockRejectedValue(new Error("invalid"));
    await expect(withSerializableRetry(async () => "never"))
      .rejects.toThrow("invalid");
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
  });
});
