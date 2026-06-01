// POST /api/settlement/run — run month-end settlement (admin only)

import { requireAdmin } from "@/lib/session";
import { db } from "@/lib/db";
import { computeSettlement } from "@/lib/domain/settlement";
import { currentMonthStart, currentMonthEnd, currentMonthKey, getNow, firstDayOfMonth, lastDayOfMonth } from "@/lib/utils/dates";
import { fetchMonthBalances } from "@/lib/queries/balance";

export async function POST(request: Request) {
  try {
    await requireAdmin();

    let monthKey = currentMonthKey(); // default to current month's YYYY-MM-01
    try {
      const body = await request.json() as { month?: string };
      if (body.month && /^\d{4}-\d{2}$/.test(body.month)) {
        monthKey = `${body.month}-01`;
      }
    } catch {
      // Ignore if body is empty/invalid
    }

    const monthDate = new Date(monthKey);

    // Block duplicate settlement
    const existing = await db.monthlySettlement.findFirst({
      where: { month: monthDate },
    });
    if (existing) {
      return Response.json({ error: "This month has already been settled." }, { status: 400 });
    }

    const [yearStr, monthStr] = monthKey.split("-");
    const year = parseInt(yearStr!);
    const month = parseInt(monthStr!);

    const monthStart = firstDayOfMonth(year, month);
    const monthEnd = lastDayOfMonth(year, month);
    const isCurrent = monthKey === currentMonthKey();

    const result = await fetchMonthBalances({
      monthStart,
      monthEnd,
      monthDate,
      isCurrentMonth: isCurrent,
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
        month: monthKey.slice(0, 7), // "YYYY-MM"
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
