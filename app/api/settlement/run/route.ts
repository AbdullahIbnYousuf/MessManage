// POST /api/settlement/run — run month-end settlement (admin only)

import { requireAdmin } from "@/lib/session";
import { db } from "@/lib/db";
import { computeSettlement } from "@/lib/domain/settlement";
import { currentMonthStart, currentMonthEnd, currentMonthKey, getNow } from "@/lib/utils/dates";
import { fetchMonthBalances } from "@/lib/queries/balance";

export async function POST() {
  try {
    await requireAdmin();

    const monthKey = currentMonthKey();
    const monthDate = new Date(monthKey);

    // Block duplicate settlement
    const existing = await db.monthlySettlement.findFirst({
      where: { month: monthDate },
    });
    if (existing) {
      return Response.json({ error: "This month has already been settled." }, { status: 400 });
    }

    const result = await fetchMonthBalances({
      monthStart: currentMonthStart(),
      monthEnd: currentMonthEnd(),
      monthDate,
      isCurrentMonth: true,
    });

    const transfers = computeSettlement(result.members);
    const now = getNow();

    // Write all settlement rows atomically
    await db.$transaction(async (tx) => {
      await tx.monthlySettlement.createMany({
        data: transfers.map((t) => ({
          month: monthDate,
          fromUserId: t.fromUserId,
          toUserId: t.toUserId,
          amount: t.amount,
          settledAt: now,
        })),
      });
    });

    return Response.json({
      data: {
        month: monthKey,
        transfers: transfers.map((t) => ({
          fromUserId: t.fromUserId,
          fromUserName: t.fromUserName,
          toUserId: t.toUserId,
          toUserName: t.toUserName,
          amount: t.amount.toFixed(2),
        })),
      },
    });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error(err);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
