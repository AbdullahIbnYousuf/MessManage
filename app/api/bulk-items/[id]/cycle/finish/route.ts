// POST /api/bulk-items/[id]/cycle/finish — mark the active cycle as finished
// Immediately computes and posts BulkAllocation rows for all members

import { requireAuth } from "@/lib/session";
import { db } from "@/lib/db";
import { computeUserBulkAllocation } from "@/lib/domain/bulk";
import Decimal from "decimal.js";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: bulkItemId } = await params;

    // Find the active cycle for this item
    const cycle = await db.bulkCycle.findFirst({
      where: { bulkItemId, status: "active" },
    });

    if (!cycle) {
      return Response.json({ error: "No active cycle found for this item." }, { status: 404 });
    }

    const finishedAt = new Date();

    // Sum all meals per user during the cycle period (startedAt → now)
    // Use locked meal records only (all past records are locked, so this is safe)
    const mealTotals = await db.mealRecord.groupBy({
      by: ["userId"],
      where: {
        date: {
          gte: cycle.startedAt,
          lte: finishedAt,
        },
        isLocked: true,
      },
      _sum: { mealCount: true },
    });

    const totalMeals = mealTotals.reduce(
      (sum, row) => sum + (row._sum.mealCount ?? 0),
      0
    );

    const cycleCost = new Decimal(cycle.cost.toString());
    const now = new Date();

    // Build allocation rows for all users who had meals during the cycle
    const allocationRows = mealTotals
      .filter((row) => (row._sum.mealCount ?? 0) > 0)
      .map((row) => {
        const userMeals = row._sum.mealCount ?? 0;
        const allocation = computeUserBulkAllocation(cycleCost, totalMeals, userMeals);
        return {
          cycleId: cycle.id,
          userId: row.userId,
          mealsDuringCycle: userMeals,
          amount: allocation,
          allocatedAt: now,
        };
      });

    // Close cycle + create allocation rows atomically
    await db.$transaction([
      db.bulkCycle.update({
        where: { id: cycle.id },
        data: {
          status: "finished",
          finishedAt,
          finishedById: user.id,
        },
      }),
      db.bulkAllocation.createMany({ data: allocationRows }),
    ]);

    return Response.json({
      data: {
        cycleId: cycle.id,
        finishedAt: finishedAt.toISOString(),
        totalMeals,
        allocationsCreated: allocationRows.length,
      },
    });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error(err);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
