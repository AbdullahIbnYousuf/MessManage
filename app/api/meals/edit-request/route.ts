// POST /api/meals/edit-request — submit a MealEditRequest after deadline has passed

import { requireAuth } from "@/lib/session";
import { db } from "@/lib/db";
import { today } from "@/lib/utils/dates";
import { canRequestEdit } from "@/lib/domain/meal";
import { isDeadlinePassed } from "@/lib/utils/dates";

export async function POST() {
  try {
    const user = await requireAuth();
    const dateStr = today();

    const config = await db.systemConfig.findFirst();
    const deadlinePassed = isDeadlinePassed(config?.mealDeadline ?? "22:00");

    // Find today's record
    const record = await db.mealRecord.findUnique({
      where: { userId_date: { userId: user.id, date: new Date(dateStr) } },
    });

    if (!record) {
      return Response.json({ error: "Meal record not found for today." }, { status: 404 });
    }

    if (!canRequestEdit(dateStr, deadlinePassed, record.isLocked)) {
      if (record.isLocked) {
        return Response.json({ error: "This meal record is permanently locked." }, { status: 400 });
      }
      if (!deadlinePassed) {
        return Response.json({ error: "The deadline has not passed yet. Edit your meals directly." }, { status: 400 });
      }
      return Response.json({ error: "Cannot request an edit for this record." }, { status: 400 });
    }

    // Check for an existing pending request for today's record
    const existing = await db.mealEditRequest.findFirst({
      where: { userId: user.id, mealRecordId: record.id, status: "pending" },
    });

    if (existing) {
      return Response.json({ error: "You already have a pending edit request for today." }, { status: 400 });
    }

    const editRequest = await db.mealEditRequest.create({
      data: {
        userId: user.id,
        mealRecordId: record.id,
        status: "pending",
        requestedAt: new Date(),
      },
    });

    return Response.json({ data: { id: editRequest.id, status: "pending" } }, { status: 201 });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error(err);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

// GET /api/meals/edit-request — get current user's edit request for today
export async function GET() {
  try {
    const user = await requireAuth();
    const dateStr = today();

    const record = await db.mealRecord.findUnique({
      where: { userId_date: { userId: user.id, date: new Date(dateStr) } },
    });

    if (!record) {
      return Response.json({ data: null });
    }

    const editRequest = await db.mealEditRequest.findFirst({
      where: { userId: user.id, mealRecordId: record.id },
      orderBy: { requestedAt: "desc" },
    });

    return Response.json({ data: editRequest ? { id: editRequest.id, status: editRequest.status } : null });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error(err);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
