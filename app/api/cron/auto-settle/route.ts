// GET /api/cron/auto-settle — cron job to automatically run month-end settlement
// Runs on the 5th of every month. Settles the *previous* calendar month.

import { db } from "@/lib/db";
import { computeSettlement } from "@/lib/domain/settlement";
import { previousMonthKey, previousMonthStart, previousMonthEnd, getNow } from "@/lib/utils/dates";
import { fetchMonthBalances } from "@/lib/queries/balance";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorised" }, { status: 401 });
  }

  try {
    const monthKey = previousMonthKey();
    const monthDate = new Date(monthKey);

    // Block duplicate settlement — skip silently if already settled (idempotent)
    const existing = await db.monthlySettlement.findFirst({
      where: { month: monthDate },
    });
    if (existing) {
      return Response.json({ message: "Already settled for the previous month." });
    }

    const result = await fetchMonthBalances({
      monthStart: previousMonthStart(),
      monthEnd: previousMonthEnd(),
      monthDate,
      isCurrentMonth: false, // past month — all meals are locked, no deadline logic
    });

    // Block if no data to settle (e.g., app just deployed, or system inactive)
    if (!result.hasData) {
      return Response.json({ message: "No data to settle for the previous month." });
    }

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

    return Response.json({ message: "Auto-settlement completed successfully.", transfers });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Something went wrong." }, { status: 500 });
  }
}
