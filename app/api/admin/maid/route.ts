// POST /api/admin/maid — manually apply maid charges for an unsettled month

import { requireAdmin } from "@/lib/session";
import {
  isMemberEligibleForMaidCharge,
  maidServiceMonthForAccountingMonth,
  usesDeferredMaidAccounting,
} from "@/lib/domain/maid";
import { currentMonthKey, getNow } from "@/lib/utils/dates";
import Decimal from "decimal.js";
import { withSerializableRetry } from "@/lib/services/debts/transactions";
import { assertMonthOpen } from "@/lib/services/month-state";
import { financialErrorResponse } from "@/lib/utils/financial-api";

export async function POST(request: Request) {
  try {
    await requireAdmin();

    const body = await request.json().catch(() => ({})) as { month?: unknown };
    const requestedMonth = typeof body.month === "string" ? body.month : currentMonthKey().slice(0, 7);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(requestedMonth)) {
      return Response.json({ error: "Invalid month format. Use YYYY-MM." }, { status: 400 });
    }

    const monthKey = `${requestedMonth}-01`;
    if (monthKey > currentMonthKey()) {
      return Response.json({ error: "Maid charges cannot be applied to a future month." }, { status: 400 });
    }

    const monthDate = new Date(monthKey);
    if (!usesDeferredMaidAccounting(monthDate)) {
      return Response.json(
        { error: "Maid charges before August 2026 use the closed legacy accounting period." },
        { status: 400 }
      );
    }
    const serviceMonth = maidServiceMonthForAccountingMonth(monthDate);
    const result = await withSerializableRetry(async (tx) => {
      await assertMonthOpen(tx, monthDate);

      const existing = await tx.maidCharge.findFirst({
        where: { month: monthDate },
      });
      if (existing) return { status: "already_applied" as const };

      const config = await tx.systemConfig.findFirst();
      const defaultCharge = new Decimal(config?.maidChargeDefault.toString() ?? "700");
      const members = await tx.user.findMany({
        select: { id: true, joinedAt: true, deactivatedAt: true },
      });
      const eligibleMembers = members.filter((member) =>
        isMemberEligibleForMaidCharge(member.joinedAt, member.deactivatedAt, serviceMonth)
      );
      if (eligibleMembers.length === 0) return { status: "no_members" as const };

      const now = getNow();
      const chargeRows = eligibleMembers.map((member) => ({
        userId: member.id,
        amount: defaultCharge,
        month: monthDate,
        serviceMonth,
        appliedAt: now,
      }));
      await tx.maidCharge.createMany({ data: chargeRows });
      return {
        status: "applied" as const,
        applied: chargeRows.length,
        amountEach: defaultCharge.toFixed(2),
      };
    });

    if (result.status === "already_applied") {
      return Response.json(
        { error: "Maid charges have already been applied for this month." },
        { status: 400 }
      );
    }
    if (result.status === "no_members") {
      return Response.json({ error: "No members were active during this month." }, { status: 400 });
    }

    return Response.json({
      data: { applied: result.applied, month: monthKey, amountEach: result.amountEach },
    });
  } catch (err) {
    if (err instanceof Response) return err;
    return financialErrorResponse(err, "Maid charge application");
  }
}
