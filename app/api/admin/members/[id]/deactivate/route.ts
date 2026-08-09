// GET  /api/admin/members/[id]/deactivate — preview date and debt clearance
// POST /api/admin/members/[id]/deactivate — atomically verify and deactivate

import { requireAdmin } from "@/lib/session";
import { db } from "@/lib/db";
import { DebtError } from "@/lib/domain/debts/errors";
import { fetchDebtClearance } from "@/lib/queries/debt-clearance";
import { withSerializableRetry } from "@/lib/services/debts/transactions";
import { debtErrorResponse } from "@/lib/utils/debts-api";
import { currentMonthStart, getNow, today } from "@/lib/utils/dates";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const user = await db.user.findUnique({
      where: { id },
      select: { status: true },
    });

    if (!user) throw new DebtError("MEMBER_NOT_FOUND", "Member not found.");
    if (user.status === "deactivated") {
      throw new DebtError("VALIDATION_ERROR", "This member is already deactivated.");
    }

    const deactivatedAt = getNow();
    const debtClearance = await fetchDebtClearance(db, id);

    return Response.json({
      data: {
        deactivatedAt: deactivatedAt.toISOString(),
        reason: "deactivation_time",
        debtClearance,
      },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return debtErrorResponse(error, "Deactivation preview");
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    if (id === admin.id) {
      throw new DebtError("VALIDATION_ERROR", "You cannot deactivate your own account.");
    }

    const result = await withSerializableRetry(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id },
        select: { status: true },
      });
      if (!user) throw new DebtError("MEMBER_NOT_FOUND", "Member not found.");
      if (user.status === "deactivated") {
        throw new DebtError("VALIDATION_ERROR", "This member is already deactivated.");
      }

      const debtClearance = await fetchDebtClearance(tx, id);
      if (!debtClearance.canDeactivate) {
        throw new DebtError(
          "DEACTIVATION_BLOCKED_BY_DEBT",
          "Resolve this member's debts and pending payments before deactivation.",
          {
            youOwe: debtClearance.youOwe,
            owedToYou: debtClearance.owedToYou,
            pendingCount: debtClearance.pendingCount,
            pendingPaymentCount: debtClearance.pendingPaymentCount,
            pendingDebtRequestCount: debtClearance.pendingDebtRequestCount,
          }
        );
      }

      const deactivatedAt = getNow();
      const currentMonthSettlement = await tx.monthlySettlementRun.findUnique({
        where: { month: currentMonthStart() },
        select: { id: true },
      });
      await tx.user.update({
        where: { id },
        data: { status: "deactivated", deactivatedAt },
      });
      if (!currentMonthSettlement) {
        await tx.mealRecord.updateMany({
          where: {
            userId: id,
            date: { gt: new Date(today()) },
            isLocked: false,
          },
          data: { mealCount: 0 },
        });
      }

      return { deactivatedAt };
    });

    return Response.json({
      data: {
        status: "deactivated",
        deactivatedAt: result.deactivatedAt.toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return debtErrorResponse(error, "Member deactivation");
  }
}
