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
import { Prisma, type BulkCycle } from "@prisma/client";
import { withSerializableRetry } from "@/lib/services/debts/transactions";
import { FinancialError } from "@/lib/domain/financial-errors";
import { financialErrorResponse } from "@/lib/utils/financial-api";

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

    const purchaseDate = body.purchaseDate
      ? new Date(body.purchaseDate)
      : getNow();
    if (isNaN(purchaseDate.getTime())) {
      return Response.json({ error: "Invalid purchaseDate." }, { status: 400 });
    }

    let cycle: BulkCycle;
    try {
      cycle = await withSerializableRetry(async (tx) => {
        const item = await tx.bulkItem.findUnique({ where: { id } });
        if (!item) {
          throw Response.json({ error: "Bulk item not found." }, { status: 404 });
        }
        const activeCycle = await tx.bulkCycle.findFirst({
          where: { bulkItemId: id, status: "active" },
        });
        if (activeCycle) {
          throw new FinancialError(
            "BULK_CYCLE_ALREADY_ACTIVE",
            "An active cycle already exists for this item."
          );
        }
        const lastFinished = await tx.bulkCycle.findFirst({
          where: { bulkItemId: id, status: "finished" },
          orderBy: { finishedAt: "desc" },
        });
        return tx.bulkCycle.create({
          data: {
            bulkItemId: id,
            purchasedById: user.id,
            cost: new Decimal(String(body.cost)),
            purchaseDate,
            status: "active",
            startedAt: lastFinished?.finishedAt ?? getNow(),
          },
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError
        && error.code === "P2002"
      ) {
        throw new FinancialError(
          "BULK_CYCLE_ALREADY_ACTIVE",
          "An active cycle already exists for this item."
        );
      }
      throw error;
    }

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
    return financialErrorResponse(err, "Bulk cycle creation");
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

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

    const updated = await withSerializableRetry(async (tx) => {
      const current = await tx.bulkCycle.findFirst({
        where: { id: cycle.id, status: "active" },
      });
      if (!current) return null;
      const changed = await tx.bulkCycle.updateMany({
        where: { id: current.id, status: "active" },
        data: {
          ...(cost !== undefined && { cost }),
          ...(purchaseDate !== undefined && { purchaseDate }),
        },
      });
      if (changed.count !== 1) return null;
      return tx.bulkCycle.findUniqueOrThrow({ where: { id: current.id } });
    });
    if (!updated) {
      return Response.json(
        { error: "This cycle has already been finished and cannot be edited." },
        { status: 409 }
      );
    }

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
    return financialErrorResponse(err, "Bulk cycle mutation");
  }
}
