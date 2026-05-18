// GET  /api/bulk-items — list all bulk items with their active cycle and finished cycles
// POST /api/bulk-items — add a new bulk item type

import { requireAuth } from "@/lib/session";
import { db } from "@/lib/db";

export async function GET() {
  try {
    await requireAuth();

    const items = await db.bulkItem.findMany({
      include: {
        cycles: {
          include: {
            purchasedBy: { select: { id: true, name: true, nickname: true, avatarUrl: true } },
            finishedBy: { select: { id: true, name: true, nickname: true } },
          },
          orderBy: { startedAt: "desc" },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return Response.json({
      data: items.map((item) => {
        const active = item.cycles.find((c) => c.status === "active") ?? null;
        const finished = item.cycles.filter((c) => c.status === "finished");
        return {
          id: item.id,
          name: item.name,
          unit: item.unit,
          createdAt: item.createdAt.toISOString(),
          activeCycle: active
            ? {
                id: active.id,
                cost: active.cost.toFixed(2),
                purchaseDate: active.purchaseDate.toISOString().slice(0, 10),
                startedAt: active.startedAt.toISOString(),
                purchasedBy: { ...active.purchasedBy, name: active.purchasedBy.nickname || active.purchasedBy.name },
              }
            : null,
          finishedCycles: finished.map((c) => ({
            id: c.id,
            cost: c.cost.toFixed(2),
            purchaseDate: c.purchaseDate.toISOString().slice(0, 10),
            startedAt: c.startedAt.toISOString(),
            finishedAt: c.finishedAt!.toISOString(),
            purchasedBy: { name: c.purchasedBy.nickname || c.purchasedBy.name },
            finishedBy: c.finishedBy ? { name: c.finishedBy.nickname || c.finishedBy.name } : null,
          })),
        };
      }),
    });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error(err);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAuth();

    const body = await request.json() as { name?: string; unit?: string };

    if (!body.name?.trim()) {
      return Response.json({ error: "Item name is required." }, { status: 400 });
    }

    const existing = await db.bulkItem.findUnique({ where: { name: body.name.trim() } });
    if (existing) {
      return Response.json({ error: "A bulk item with this name already exists." }, { status: 400 });
    }

    const item = await db.bulkItem.create({
      data: {
        name: body.name.trim(),
        unit: body.unit?.trim() || null,
        createdAt: new Date(),
      },
    });

    return Response.json({ data: { id: item.id, name: item.name, unit: item.unit } }, { status: 201 });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error(err);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
