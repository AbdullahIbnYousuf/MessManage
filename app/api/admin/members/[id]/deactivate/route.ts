// GET  /api/admin/members/[id]/deactivate — preview the deactivation date before committing
// POST /api/admin/members/[id]/deactivate — deactivate a member account

import { requireAdmin } from "@/lib/session";
import { db } from "@/lib/db";
import { today } from "@/lib/utils/dates";

/**
 * Computes the deactivation date for a member:
 * - If they have meals: the date of their last meal where mealCount > 0
 * - If no meals ever: their joinedAt date
 *
 * This date represents "the last day they were financially active in the system."
 * Setting deactivatedAt = this date (not the day after) ensures they are
 * excluded from the NEXT month's fridge bill and maid charges automatically.
 */
async function computeDeactivationDate(userId: string): Promise<{
  deactivatedAt: Date;
  reason: "last_meal" | "joined_date";
}> {
  const lastMealRecord = await db.mealRecord.findFirst({
    where: { userId, mealCount: { gt: 0 } },
    orderBy: { date: "desc" },
    select: { date: true },
  });

  if (lastMealRecord) {
    return { deactivatedAt: lastMealRecord.date, reason: "last_meal" };
  }

  // No meals ever — use joinedAt
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { joinedAt: true },
  });

  return {
    deactivatedAt: user!.joinedAt,
    reason: "joined_date",
  };
}

// ─── GET: Preview deactivation date ──────────────────────────────────────────

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;

    const user = await db.user.findUnique({
      where: { id },
      select: { status: true, name: true },
    });

    if (!user) {
      return Response.json({ error: "Member not found." }, { status: 404 });
    }

    if (user.status === "deactivated") {
      return Response.json({ error: "This member is already deactivated." }, { status: 400 });
    }

    const { deactivatedAt, reason } = await computeDeactivationDate(id);

    return Response.json({
      data: {
        deactivatedAt: deactivatedAt.toISOString(),
        reason,
      },
    });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error(err);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

// ─── POST: Commit deactivation ────────────────────────────────────────────────

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
    const { deactivatedAt } = await computeDeactivationDate(id);

    // Deactivate user + zero out all future meal records from tomorrow onwards
    await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: {
          status: "deactivated",
          deactivatedAt,
        },
      });

      // Set all future MealRecord rows (from tomorrow) to 0
      await tx.mealRecord.updateMany({
        where: {
          userId: id,
          date: { gt: new Date(todayStr) },
          isLocked: false,
        },
        data: { mealCount: 0 },
      });
    });

    return Response.json({
      data: {
        status: "deactivated",
        deactivatedAt: deactivatedAt.toISOString(),
      },
    });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error(err);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
