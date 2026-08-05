import Decimal from "decimal.js";
import type {
  DebtMemberTotals,
  DebtObligationBalanceRecord,
  DebtPairwisePosition,
  DebtTransferBalanceRecord,
} from "@/types/debts";
import { isBalanceAffectingTransfer } from "@/lib/domain/debts/transfers";

type PairAccumulator = {
  memberAId: string;
  memberBId: string;
  positionForMemberA: Decimal;
};

function pairKey(firstId: string, secondId: string): string {
  return firstId < secondId
    ? `${firstId}\u0000${secondId}`
    : `${secondId}\u0000${firstId}`;
}

function applyPairwiseAmount(
  positions: Map<string, PairAccumulator>,
  positiveMemberId: string,
  negativeMemberId: string,
  amount: Decimal
): void {
  if (positiveMemberId === negativeMemberId) {
    throw new Error("A debt position cannot involve the same member twice.");
  }
  if (amount.lte(0)) {
    throw new Error("Debt position amounts must be positive.");
  }

  const memberAId = positiveMemberId < negativeMemberId
    ? positiveMemberId
    : negativeMemberId;
  const memberBId = memberAId === positiveMemberId
    ? negativeMemberId
    : positiveMemberId;
  const key = pairKey(memberAId, memberBId);
  const current = positions.get(key)?.positionForMemberA ?? new Decimal(0);
  const signedAmount = positiveMemberId === memberAId ? amount : amount.negated();

  positions.set(key, {
    memberAId,
    memberBId,
    positionForMemberA: current.add(signedAmount),
  });
}

export function calculatePairwisePositions(
  obligations: DebtObligationBalanceRecord[],
  transfers: DebtTransferBalanceRecord[]
): DebtPairwisePosition[] {
  const positions = new Map<string, PairAccumulator>();

  for (const obligation of obligations) {
    applyPairwiseAmount(
      positions,
      obligation.creditorId,
      obligation.debtorId,
      new Decimal(obligation.amount)
    );
  }

  for (const transfer of transfers) {
    if (!isBalanceAffectingTransfer(transfer.status)) continue;
    applyPairwiseAmount(
      positions,
      transfer.senderId,
      transfer.receiverId,
      new Decimal(transfer.amount)
    );
  }

  return Array.from(positions.values())
    .map((position) => ({
      memberAId: position.memberAId,
      memberBId: position.memberBId,
      positionForMemberA: position.positionForMemberA.toFixed(2),
    }))
    .sort((left, right) => {
      const memberCompare = left.memberAId.localeCompare(right.memberAId);
      return memberCompare !== 0
        ? memberCompare
        : left.memberBId.localeCompare(right.memberBId);
    });
}

export function positionForMember(
  position: DebtPairwisePosition,
  memberId: string
): Decimal {
  if (position.memberAId === memberId) {
    return new Decimal(position.positionForMemberA);
  }
  if (position.memberBId === memberId) {
    return new Decimal(position.positionForMemberA).negated();
  }
  return new Decimal(0);
}

export function calculateMemberTotals(
  memberId: string,
  positions: DebtPairwisePosition[]
): DebtMemberTotals {
  let youOwe = new Decimal(0);
  let owedToYou = new Decimal(0);

  for (const position of positions) {
    const value = positionForMember(position, memberId);
    if (value.gt(0)) owedToYou = owedToYou.add(value);
    if (value.lt(0)) youOwe = youOwe.add(value.abs());
  }

  return {
    youOwe: youOwe.toFixed(2),
    owedToYou: owedToYou.toFixed(2),
    net: owedToYou.sub(youOwe).toFixed(2),
  };
}

export function calculateHouseholdNet(
  memberIds: string[],
  positions: DebtPairwisePosition[]
): Decimal {
  return memberIds.reduce(
    (total, memberId) =>
      total.add(calculateMemberTotals(memberId, positions).net),
    new Decimal(0)
  );
}
