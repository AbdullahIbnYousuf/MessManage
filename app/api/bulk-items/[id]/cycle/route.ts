// POST /api/bulk-items/[id]/cycle — start a new cycle for a bulk item (records a purchase)

import { requireAuth } from "@/lib/session";
import { db } from "@/lib/db";
import { validateBulkCost } from "@/lib/domain/bulk";
import Decimal from "decimal.js";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const body = await request.json() as {
      cost: number | string;
      purchaseDate?: string;
    };

    const costError = validateBulkCost(body.cost);
    if (costError) {
      return Response.json({ error: costError }, { status: 400 });
    }

    const item = await db.bulkItem.findUnique({ where: { id } });
    if (!item) {
      return Response.json({ error: "Bulk item not found." }, { status: 404 });
    }

    // Check no active cycle already exists for this item
    const activeCycle = await db.bulkCycle.findFirst({
      where: { bulkItemId: id, status: "active" },
    });

    if (activeCycle) {
      return Response.json(
        { error: "An active cycle already exists for this item. Finish it before starting a new one." },
        { status: 400 }
      );
    }

    // The started_at for a new cycle = finishedAt of the last finished cycle, or now if first ever
    const lastFinished = await db.bulkCycle.findFirst({
      where: { bulkItemId: id, status: "finished" },
      orderBy: { finishedAt: "desc" },
    });

    const startedAt = lastFinished?.finishedAt ?? new Date();
    const purchaseDate = body.purchaseDate
      ? new Date(body.purchaseDate)
      : new Date();

    const cycle = await db.bulkCycle.create({
      data: {
        bulkItemId: id,
        purchasedById: user.id,
        cost: new Decimal(String(body.cost)),
        purchaseDate,
        status: "active",
        startedAt,
      },
    });

    return Response.json({
      data: {
        id: cycle.id,
        cost: cycle.cost.toFixed(2),
        startedAt: cycle.startedAt.toISOString(),
        status: cycle.status,
      },
    }, { status: 201 });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error(err);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
