// POST   /api/bulk-items/[id]/cycle — start a new cycle for a bulk item (records a purchase)
// PATCH  /api/bulk-items/[id]/cycle — edit cost/purchaseDate of the active cycle
//   Rules:
//     - Submitter can edit only on the same calendar day as startedAt (before midnight).
//     - Admin can edit any time while the cycle is still active.
//     - Finished cycles can NEVER be edited — allocations are frozen.

import { requireAuth } from "@/lib/session";
import { db } from "@/lib/db";
import { validateBulkCost } from "@/lib/domain/bulk";
import { getNow, toDateString } from "@/lib/utils/dates";
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

    const startedAt = lastFinished?.finishedAt ?? getNow();
    const purchaseDate = body.purchaseDate
      ? new Date(body.purchaseDate)
      : getNow();

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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    // Find the active cycle for this item
    const cycle = await db.bulkCycle.findFirst({
      where: { bulkItemId: id, status: "active" },
    });

    if (!cycle) {
      return Response.json(
        { error: "No active cycle found for this item. Finished cycles cannot be edited." },
        { status: 404 }
      );
    }

    const isAdmin = user.role === "admin";
    const isOwner = cycle.purchasedById === user.id;

    if (!isAdmin && !isOwner) {
      return Response.json({ error: "You can only edit a cycle you recorded." }, { status: 403 });
    }

    const now = getNow();
    const todayStr = toDateString(now);
    const startedDateStr = toDateString(new Date(cycle.startedAt));

    // Submitter rule: same calendar day as startedAt only
    if (!isAdmin && startedDateStr !== todayStr) {
      return Response.json(
        { error: "You can only edit the cost on the day you recorded the purchase." },
        { status: 403 }
      );
    }

    const body = await request.json() as {
      cost?: number | string;
      purchaseDate?: string;
    };

    let cost: Decimal | undefined;
    if (body.cost !== undefined) {
      const costError = validateBulkCost(body.cost);
      if (costError) {
        return Response.json({ error: costError }, { status: 400 });
      }
      cost = new Decimal(String(body.cost));
    }

    let purchaseDate: Date | undefined;
    if (body.purchaseDate !== undefined) {
      purchaseDate = new Date(body.purchaseDate);
      if (isNaN(purchaseDate.getTime())) {
        return Response.json({ error: "Invalid purchaseDate." }, { status: 400 });
      }
    }

    if (cost === undefined && purchaseDate === undefined) {
      return Response.json({ error: "Nothing to update." }, { status: 400 });
    }

    const updated = await db.bulkCycle.update({
      where: { id: cycle.id },
      data: {
        ...(cost !== undefined && { cost }),
        ...(purchaseDate !== undefined && { purchaseDate }),
      },
    });

    return Response.json({
      data: {
        id: updated.id,
        cost: updated.cost.toFixed(2),
        purchaseDate: updated.purchaseDate.toISOString().slice(0, 10),
        status: updated.status,
      },
    });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error(err);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
