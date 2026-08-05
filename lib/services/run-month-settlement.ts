import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  computeSettlement,
  type SettlementTransfer,
} from "@/lib/domain/settlement";
import { fetchMonthBalances } from "@/lib/queries/balance";
import { fetchSettlementReadiness } from "@/lib/queries/settlement-readiness";
import { deliverDebtNotifications } from "@/lib/services/debts/notifications";
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
  | { status: "blocked"; month: string; reasons: string[] };

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

function obligationNotificationCopy(
  direction: "debtor" | "creditor",
  transfer: SettlementTransfer,
  monthKey: string
): { title: string; body: string } {
  const month = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(monthKey));
  const amount = transfer.amount.toFixed(2);

  return direction === "debtor"
    ? {
        title: "New settlement amount due",
        body: `You owe ${transfer.toUserName} Tk ${amount} for ${month}.`,
      }
    : {
        title: "New settlement amount receivable",
        body: `${transfer.fromUserName} owes you Tk ${amount} for ${month}.`,
      };
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
  if (input.trigger === "manual" && !input.actorId) {
    return {
      status: "blocked",
      month: input.monthKey,
      reasons: ["A manual settlement requires an admin actor."],
    };
  }

  const { monthDate, monthStart, monthEnd } = parsedMonth;
  const existingRun = await db.monthlySettlementRun.findUnique({
    where: { month: monthDate },
    select: { id: true },
  });
  if (existingRun) {
    return { status: "already_settled", month: input.monthKey };
  }

  const [balanceResult, readinessReasons] = await Promise.all([
    fetchMonthBalances({
      monthStart,
      monthEnd,
      monthDate,
      isCurrentMonth: input.monthKey === currentMonthKey(),
    }),
    fetchSettlementReadiness({ monthDate, monthStart, monthEnd }),
  ]);

  if (!balanceResult.hasData) {
    return { status: "no_data", month: input.monthKey };
  }
  if (readinessReasons.length > 0) {
    return {
      status: "blocked",
      month: input.monthKey,
      reasons: readinessReasons,
    };
  }

  const transfers = computeSettlement(balanceResult.members);
  const settledAt = getNow();

  try {
    const notificationIds = await db.$transaction(async (tx) => {
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
        const debtorCopy = obligationNotificationCopy(
          "debtor",
          transfer,
          input.monthKey
        );
        const creditorCopy = obligationNotificationCopy(
          "creditor",
          transfer,
          input.monthKey
        );
        const notifications = await Promise.all([
          tx.debtNotification.create({
            data: {
              userId: transfer.fromUserId,
              type: "obligation_created",
              entityType: "obligation",
              entityId: obligation.id,
              ...debtorCopy,
            },
            select: { id: true },
          }),
          tx.debtNotification.create({
            data: {
              userId: transfer.toUserId,
              type: "obligation_created",
              entityType: "obligation",
              entityId: obligation.id,
              ...creditorCopy,
            },
            select: { id: true },
          }),
        ]);
        createdNotificationIds.push(...notifications.map(({ id }) => id));
      }

      return createdNotificationIds;
    });

    try {
      await deliverDebtNotifications(notificationIds);
    } catch (error) {
      console.error("DebtSync push delivery failed after settlement commit.", error);
    }

    return {
      status: "completed",
      month: input.monthKey,
      transfers,
      notificationIds,
    };
  } catch (error) {
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
