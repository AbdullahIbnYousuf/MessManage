// POST /api/admin/members/[id]/reactivate — Reactivate a member account

import { requireAdmin } from "@/lib/session";
import { currentMonthStart, today } from "@/lib/utils/dates";
import { futureDatesInCurrentMonth, applyPatternToDate } from "@/lib/domain/meal";
import { withSerializableRetry } from "@/lib/services/debts/transactions";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;

    const todayStr = today();

    // Reactivate user + regenerate all future meal records from tomorrow onwards using pattern
    await withSerializableRetry(async (tx) => {
      const user = await tx.user.findUnique({ where: { id } });
      if (!user) {
        throw Response.json({ error: "Member not found." }, { status: 404 });
      }
      if (user.status === "active") {
        throw Response.json(
          { error: "This member is already active." },
          { status: 400 }
        );
      }
      const currentMonthSettlement = await tx.monthlySettlementRun.findUnique({
        where: { month: currentMonthStart() },
        select: { id: true },
      });
      await tx.user.update({
        where: { id },
        data: {
          status: "active",
          deactivatedAt: null,
        },
      });

      const pattern = currentMonthSettlement
        ? null
        : await tx.mealPattern.findUnique({ where: { userId: id } });
      if (pattern !== null) {
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
