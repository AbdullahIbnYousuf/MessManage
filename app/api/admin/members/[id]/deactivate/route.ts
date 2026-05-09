// POST /api/admin/members/[id]/deactivate — Deactivate a member account

import { requireAdmin } from "@/lib/session";
import { db } from "@/lib/db";
import { today } from "@/lib/utils/dates";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;

    if (id === admin.id) {
      return Response.json({ error: "You cannot deactivate your own account." }, { status: 400 });
    }

    const user = await db.user.findUnique({ where: { id } });

    if (!user) {
      return Response.json({ error: "Member not found." }, { status: 404 });
    }

    if (user.status === "deactivated") {
      return Response.json({ error: "This member is already deactivated." }, { status: 400 });
    }

    const todayStr = today();

    // Deactivate user + zero out all future meal records from tomorrow onwards
    await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: {
          status: "deactivated",
          deactivatedAt: new Date(),
        },
      });

      // Set all future MealRecord rows (from tomorrow) to 0 and lock them
      await tx.mealRecord.updateMany({
        where: {
          userId: id,
          date: { gt: new Date(todayStr) },
          isLocked: false,
        },
        data: { mealCount: 0 },
      });
    });

    return Response.json({ data: { status: "deactivated" } });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error(err);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
