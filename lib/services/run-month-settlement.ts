import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  assertSettlementInvariants,
  computeSettlement,
  type SettlementTransfer,
} from "@/lib/domain/settlement";
import { FinancialError, type FinancialErrorCode } from "@/lib/domain/financial-errors";
import { buildObligationNotifications } from "@/lib/domain/debts/notifications";
import { fetchMonthBalances } from "@/lib/queries/balance";
import { fetchSettlementReadiness } from "@/lib/queries/settlement-readiness";
import {
  deliverDebtNotifications,
  persistDebtNotifications,
} from "@/lib/services/debts/notifications";
import { withSerializableRetry } from "@/lib/services/debts/transactions";
import {
  currentMonthKey,
  firstDayOfMonth,
  getNow,
  lastDayOfMonth,
} from "@/lib/utils/dates";

export type RunMonthSettlementInput = {
  monthKey: string;
  trigger: "manual" | "cron";
  actorId?: string;
};

export type RunMonthSettlementResult =
  | {
      status: "completed";
      month: string;
      transfers: SettlementTransfer[];
      notificationIds: string[];
    }
  | { status: "already_settled"; month: string }
  | { status: "no_data"; month: string }
  | {
      status: "blocked";
      month: string;
      reasons: string[];
      code?: FinancialErrorCode;
    };

function parseMonthKey(monthKey: string): {
  monthDate: Date;
  monthStart: Date;
  monthEnd: Date;
} | null {
  const match = /^(\d{4})-(0[1-9]|1[0-2])-01$/.exec(monthKey);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const monthDate = firstDayOfMonth(year, month);
  return {
    monthDate,
    monthStart: monthDate,
    monthEnd: lastDayOfMonth(year, month),
  };
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError
    && error.code === "P2002"
  );
}

export async function runMonthSettlement(
  input: RunMonthSettlementInput
): Promise<RunMonthSettlementResult> {
  const parsedMonth = parseMonthKey(input.monthKey);
  if (!parsedMonth) {
    return {
      status: "blocked",
      month: input.monthKey,
      reasons: ["Invalid settlement month. Use YYYY-MM-01."],
    };
  }
  if (input.monthKey >= currentMonthKey()) {
    return {
      status: "blocked",
      month: input.monthKey,
      reasons: ["Only a completed past month can be settled."],
      code: "SETTLEMENT_MONTH_NOT_CLOSED",
    };
  }
  if (input.trigger === "manual" && !input.actorId) {
    return {
      status: "blocked",
      month: input.monthKey,
      reasons: ["A manual settlement requires an admin actor."],
    };
  }

  const { monthDate, monthStart, monthEnd } = parsedMonth;

  try {
    const transactionResult = await withSerializableRetry(async (tx) => {
      const existingRun = await tx.monthlySettlementRun.findUnique({
        where: { month: monthDate },
        select: { id: true },
      });
      if (existingRun) {
        return { status: "already_settled" as const };
      }

      const [balanceResult, readinessReasons] = await Promise.all([
        fetchMonthBalances({
          monthStart,
          monthEnd,
          monthDate,
          isCurrentMonth: false,
          client: tx,
        }),
        fetchSettlementReadiness({ monthDate, monthStart, monthEnd }, tx),
      ]);

      if (!balanceResult.hasData) {
        return { status: "no_data" as const };
      }
      if (balanceResult.totalMonthMeals === 0 && !balanceResult.totalMonthBazar.isZero()) {
        return {
          status: "blocked" as const,
          reasons: [
            "Bazar spending cannot be allocated because this month has no recorded meals.",
          ],
          code: "SETTLEMENT_UNBALANCED" as const,
        };
      }
      if (readinessReasons.length > 0) {
        return {
          status: "blocked" as const,
          reasons: readinessReasons,
        };
      }

      const transfers = computeSettlement(balanceResult.members);
      assertSettlementInvariants(balanceResult.members, transfers);
      const settledAt = getNow();
      const run = await tx.monthlySettlementRun.create({
        data: {
          month: monthDate,
          trigger: input.trigger,
          settledById: input.trigger === "manual" ? input.actorId : null,
          settledAt,
        },
      });
      const createdNotificationIds: string[] = [];

      for (const transfer of transfers) {
        const settlement = await tx.monthlySettlement.create({
          data: {
            month: monthDate,
            fromUserId: transfer.fromUserId,
            toUserId: transfer.toUserId,
            amount: transfer.amount,
            settledAt,
            runId: run.id,
          },
        });
        const obligation = await tx.debtObligation.create({
          data: {
            debtorId: transfer.fromUserId,
            creditorId: transfer.toUserId,
            amount: transfer.amount,
            source: "meal_settlement",
            sourceReference: `meal-settlement:${settlement.id}`,
            monthlySettlementId: settlement.id,
            createdAt: settledAt,
          },
        });
        const notificationIds = await persistDebtNotifications(
          tx,
          buildObligationNotifications(obligation.id, transfer, input.monthKey)
        );
        createdNotificationIds.push(...notificationIds);
      }

      return {
        status: "completed" as const,
        transfers,
        notificationIds: createdNotificationIds,
      };
    });

    if (transactionResult.status === "already_settled") {
      return { status: "already_settled", month: input.monthKey };
    }
    if (transactionResult.status === "no_data") {
      return { status: "no_data", month: input.monthKey };
    }
    if (transactionResult.status === "blocked") {
      return {
        status: "blocked",
        month: input.monthKey,
        reasons: transactionResult.reasons,
        code: transactionResult.code,
      };
    }

    try {
      await deliverDebtNotifications(transactionResult.notificationIds);
    } catch (error) {
      console.error("DebtSync push delivery failed after settlement commit.", error);
    }

    return {
      status: "completed",
      month: input.monthKey,
      transfers: transactionResult.transfers,
      notificationIds: transactionResult.notificationIds,
    };
  } catch (error) {
    if (error instanceof FinancialError) {
      return {
        status: "blocked",
        month: input.monthKey,
        reasons: [error.message],
        code: error.code,
      };
    }
    if (isUniqueConstraintError(error)) {
      const winner = await db.monthlySettlementRun.findUnique({
        where: { month: monthDate },
        select: { id: true },
      });
      if (winner) {
        return { status: "already_settled", month: input.monthKey };
      }
    }
    throw error;
  }
}
