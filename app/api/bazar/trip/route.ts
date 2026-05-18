// GET  /api/bazar/trip  — get the currently open trip (or null)
// POST /api/bazar/trip  — trigger a new bazar trip

import { requireAuth } from "@/lib/session";
import { db } from "@/lib/db";
import { canOpenTrip, suggestAssignees } from "@/lib/domain/bazar";
import { getNow } from "@/lib/utils/dates";

export async function GET() {
  try {
    await requireAuth();

    const config = await db.systemConfig.findFirst({
      include: {
        activeTrip: {
          include: {
            assignee1: { select: { id: true, name: true, nickname: true, avatarUrl: true } },
            assignee2: { select: { id: true, name: true, nickname: true, avatarUrl: true } },
          },
        },
      },
    });

    if (!config?.activeTrip) {
      return Response.json({ data: null });
    }

    const trip = config.activeTrip;
    return Response.json({
      data: {
        id: trip.id,
        status: trip.status,
        triggeredAt: trip.triggeredAt.toISOString(),
        shoppingNotes: trip.shoppingNotes,
        assignee1: trip.assignee1 ? { ...trip.assignee1, name: trip.assignee1.nickname || trip.assignee1.name } : null,
        assignee2: trip.assignee2 ? { ...trip.assignee2, name: trip.assignee2.nickname || trip.assignee2.name } : null,
      },
    });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error(err);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

export async function POST() {
  try {
    const user = await requireAuth();

    const config = await db.systemConfig.findFirst();

    if (!canOpenTrip(config?.activeTripId !== null && config?.activeTripId !== undefined)) {
      return Response.json({ error: "A bazar trip is already open." }, { status: 400 });
    }

    // Calculate visit counts to suggest assignees
    const members = await db.user.findMany({
      where: { status: "active" },
      select: { id: true, name: true, nickname: true, avatarUrl: true },
    });

    const expenseCounts = await db.bazarExpense.groupBy({
      by: ["userId"],
      _count: { id: true },
    });

    const countMap = new Map(expenseCounts.map((e) => [e.userId, e._count.id]));

    const membersWithCounts = members.map((m) => ({
      ...m,
      visitCount: countMap.get(m.id) ?? 0,
    }));

    const [a1, a2] = suggestAssignees(membersWithCounts);

    // Create trip + update SystemConfig.activeTripId atomically
    const trip = await db.$transaction(async (tx) => {
      const newTrip = await tx.bazarTrip.create({
        data: {
          triggeredById: user.id,
          assignee1Id: a1?.id ?? null,
          assignee2Id: a2?.id ?? null,
          status: "open",
          triggeredAt: getNow(),
        },
      });

      await tx.systemConfig.updateMany({
        data: { activeTripId: newTrip.id },
      });

      return newTrip;
    });

    return Response.json({
      data: {
        id: trip.id,
        status: trip.status,
        triggeredAt: trip.triggeredAt.toISOString(),
        shoppingNotes: null,
        assignee1: a1 ? { id: a1.id, name: a1.nickname || a1.name, avatarUrl: a1.avatarUrl } : null,
        assignee2: a2 ? { id: a2.id, name: a2.nickname || a2.name, avatarUrl: a2.avatarUrl } : null,
      },
    }, { status: 201 });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error(err);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
