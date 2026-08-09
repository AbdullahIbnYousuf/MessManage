// PUT /api/meals/records/[date] — update meal count for today's record only

import { requireAuth } from "@/lib/session";
import { db } from "@/lib/db";
import { today } from "@/lib/utils/dates";
import { canEditDirectly } from "@/lib/domain/meal";
import { isDeadlinePassed } from "@/lib/utils/dates";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ date: string }> }
) {
  try {
    const user = await requireAuth();
    const { date } = await params;

    // Past dates cannot be edited
    if (date < today()) {
      return Response.json(
        { error: "Past meal records cannot be edited." },
        { status: 400 }
      );
    }

    const body = await request.json() as { mealCount: number };
    const { mealCount } = body;

    if (!Number.isInteger(mealCount) || mealCount < 0) {
      return Response.json({ error: "Meal count must be a non-negative integer." }, { status: 400 });
    }

    // Get system config for deadline
    const config = await db.systemConfig.findFirst();
    const deadlinePassed = isDeadlinePassed(config?.mealDeadline ?? "22:00");

    // Find the record
    const record = await db.mealRecord.findUnique({
      where: { userId_date: { userId: user.id, date: new Date(date) } },
    });

    if (!record) {
      return Response.json({ error: "Meal record not found." }, { status: 404 });
    }

    if (record.isLocked) {
      return Response.json({ error: "This meal record is permanently locked." }, { status: 400 });
    }

    if (!canEditDirectly(date, deadlinePassed)) {
      const hasApprovedRequest = await db.mealEditRequest.findFirst({
        where: {
          userId: user.id,
          mealRecordId: record.id,
          status: "approved",
        },
      });

      if (!hasApprovedRequest) {
        return Response.json(
          { error: "The meal deadline has passed. Submit an edit request instead." },
          { status: 400 }
        );
      }
    }

    const updated = await db.mealRecord.update({
      where: { id: record.id },
      data: { mealCount },
    });

    return Response.json({
      data: {
        id: updated.id,
        date: updated.date.toISOString().slice(0, 10),
        mealCount: updated.mealCount,
        isLocked: updated.isLocked,
      },
    });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error(err);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
