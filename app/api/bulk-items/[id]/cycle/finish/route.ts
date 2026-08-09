// POST /api/bulk-items/[id]/cycle/finish — mark the active cycle as finished
// Immediately computes and posts BulkAllocation rows for all members

import { requireAuth } from "@/lib/session";
import { computeBulkAllocations } from "@/lib/domain/bulk";
import Decimal from "decimal.js";
import {
  firstDayOfMonth,
  getDhakaParts,
  getNow,
  isDeadlinePassed,
  today,
} from "@/lib/utils/dates";
import { withSerializableRetry } from "@/lib/services/debts/transactions";
import { assertMonthOpen } from "@/lib/services/month-state";
import { financialErrorResponse } from "@/lib/utils/financial-api";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    if (user.role !== 'admin') {
      return Response.json({ error: "Forbidden. Only admins can finish a bulk cycle." }, { status: 403 });
    }
    const { id: bulkItemId } = await params;

    const finishedAt = getNow();
    const todayDate = new Date(today());
    const finishedParts = getDhakaParts(finishedAt);
    const finishMonth = firstDayOfMonth(finishedParts.y, finishedParts.m);

    const result = await withSerializableRetry(async (tx) => {
      const cycle = await tx.bulkCycle.findFirst({
        where: { bulkItemId, status: "active" },
      });
      if (!cycle) {
        throw Response.json({ error: "No active cycle found for this item." }, { status: 404 });
      }
      await assertMonthOpen(tx, finishMonth);
      const config = await tx.systemConfig.findFirst({
        select: { mealDeadline: true },
      });
      const passed = isDeadlinePassed(config?.mealDeadline ?? "22:00");
      const mealTotals = await tx.mealRecord.groupBy({
        by: ["userId"],
        where: {
          date: { gte: cycle.startedAt, lte: finishedAt },
          OR: [
            { date: passed ? { lte: todayDate } : { lt: todayDate } },
            { isLocked: true },
          ],
        },
        _sum: { mealCount: true },
      });
      const totalMeals = mealTotals.reduce(
        (sum, row) => sum + (row._sum.mealCount ?? 0),
        0
      );
      if (totalMeals === 0) {
        throw Response.json(
          { error: "A bulk cycle cannot be finished without recorded meals." },
          { status: 409 }
        );
      }
      const allocationRows = computeBulkAllocations(
        new Decimal(cycle.cost.toString()),
        mealTotals.map((row) => ({
          userId: row.userId,
          meals: row._sum.mealCount ?? 0,
        }))
      ).map((allocation) => ({
        cycleId: cycle.id,
        userId: allocation.userId,
        mealsDuringCycle: allocation.meals,
        amount: allocation.amount,
        allocatedAt: finishedAt,
      }));
      const closed = await tx.bulkCycle.updateMany({
        where: { id: cycle.id, status: "active" },
        data: {
          status: "finished",
          finishedAt,
          finishedById: user.id,
        },
      });
      if (closed.count !== 1) {
        throw Response.json(
          { error: "This bulk cycle has already been finished." },
          { status: 409 }
        );
      }
      await tx.bulkAllocation.createMany({ data: allocationRows });
      return { cycleId: cycle.id, totalMeals, allocationsCreated: allocationRows.length };
    });

    return Response.json({
      data: {
        cycleId: result.cycleId,
        finishedAt: finishedAt.toISOString(),
        totalMeals: result.totalMeals,
        allocationsCreated: result.allocationsCreated,
      },
    });
  } catch (err) {
    if (err instanceof Response) return err;
    return financialErrorResponse(err, "Bulk cycle finish");
  }
}
