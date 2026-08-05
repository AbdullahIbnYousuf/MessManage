import Decimal from "decimal.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { transfer: { findMany: mocks.findMany } } }));

import { fetchDebtPayments } from "@/lib/queries/debts";

const currentUserId = "00000000-0000-4000-8000-000000000001";
const otherUserId = "00000000-0000-4000-8000-000000000002";

function member(id: string, name: string) {
  return { id, name, nickname: null, avatarUrl: null };
}

function row(
  id: string,
  senderId: string,
  receiverId: string,
  initiatedById: string | null
) {
  return {
    id,
    senderId,
    receiverId,
    initiatedById,
    amount: new Decimal("25.00"),
    description: null,
    status: "pending" as const,
    source: "direct" as const,
    clientRequestId: id,
    reversesTransferId: null,
    rejectionReason: null,
    createdAt: new Date(`2026-08-0${id}T00:00:00.000Z`),
    respondedAt: null,
    cancelledAt: null,
    sender: member(senderId, senderId === currentUserId ? "Current" : "Other"),
    receiver: member(receiverId, receiverId === currentUserId ? "Current" : "Other"),
  };
}

describe("DebtSync payment action filters", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.findMany.mockResolvedValue([
      row("1", currentUserId, otherUserId, null),
      row("2", otherUserId, currentUserId, currentUserId),
      row("3", otherUserId, currentUserId, otherUserId),
      row("4", currentUserId, otherUserId, otherUserId),
    ]);
  });

  it("treats legacy sender records and received-money records as initiated by me", async () => {
    const page = await fetchDebtPayments({
      currentUserId,
      action: "initiated_by_me",
      status: "pending",
      limit: 25,
    });
    expect(page.entries.map((entry) => entry.id).sort()).toEqual(["1", "2"]);
  });

  it("returns records where the current member is the non-initiating confirmer", async () => {
    const page = await fetchDebtPayments({
      currentUserId,
      action: "needs_response",
      status: "pending",
      limit: 25,
    });
    expect(page.entries.map((entry) => entry.id).sort()).toEqual(["3", "4"]);
  });
});
