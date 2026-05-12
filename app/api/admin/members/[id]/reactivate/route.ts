// POST /api/admin/members/[id]/reactivate — Reactivate a member account

import { requireAdmin } from "@/lib/session";
import { db } from "@/lib/db";
import { today } from "@/lib/utils/dates";
import { futureDatesInCurrentMonth, applyPatternToDate } from "@/lib/domain/meal";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;

    const user = await db.user.findUnique({ where: { id } });

    if (!user) {
      return Response.json({ error: "Member not found." }, { status: 404 });
    }

    if (user.status === "active") {
      return Response.json({ error: "This member is already active." }, { status: 400 });
    }

    const todayStr = today();

    // Reactivate user + regenerate all future meal records from tomorrow onwards using pattern
    await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: {
          status: "active",
          deactivatedAt: null,
        },
      });

      const pattern = await tx.mealPattern.findUnique({ where: { userId: id } });
      if (pattern) {
        const futureDates = futureDatesInCurrentMonth().filter(d => d > todayStr);
        for (const dateStr of futureDates) {
          const newCount = applyPatternToDate(pattern, dateStr);
          await tx.mealRecord.updateMany({
            where: { userId: id, date: new Date(dateStr), isLocked: false },
            data: { mealCount: newCount },
          });
        }
      }
    });

    return Response.json({ data: { status: "active" } });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error(err);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
