import type { Prisma } from "@prisma/client";
import { calculateMemberTotals, calculatePairwisePositions } from "@/lib/domain/debts";
import type { DebtClearance } from "@/types/debts";

type DebtReadClient = Pick<
  Prisma.TransactionClient,
  "debtObligation" | "transfer" | "debtRequest"
>;

export async function fetchDebtClearance(
  client: DebtReadClient,
  userId: string
): Promise<DebtClearance> {
  const [obligations, transfers, pendingDebtRequestCount] = await Promise.all([
    client.debtObligation.findMany({
      where: { OR: [{ debtorId: userId }, { creditorId: userId }] },
      select: { debtorId: true, creditorId: true, amount: true },
    }),
    client.transfer.findMany({
      where: { OR: [{ senderId: userId }, { receiverId: userId }] },
      select: {
        senderId: true,
        receiverId: true,
        amount: true,
        status: true,
      },
    }),
    client.debtRequest.count({
      where: {
        status: "pending",
        OR: [{ requesterId: userId }, { debtorId: userId }],
      },
    }),
  ]);

  const positions = calculatePairwisePositions(
    obligations.map((row) => ({ ...row, amount: row.amount.toFixed(2) })),
    transfers.map((row) => ({ ...row, amount: row.amount.toFixed(2) }))
  );
  const totals = calculateMemberTotals(userId, positions);
  const pendingPaymentCount = transfers.filter((row) => row.status === "pending").length;
  const pendingCount = pendingPaymentCount + pendingDebtRequestCount;

  return {
    ...totals,
    pendingCount,
    pendingPaymentCount,
    pendingDebtRequestCount,
    canDeactivate:
      totals.youOwe === "0.00"
      && totals.owedToYou === "0.00"
      && pendingCount === 0,
  };
}
