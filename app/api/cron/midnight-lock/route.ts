// GET /api/cron/midnight-lock — locks yesterday's meal records and expires pending edit requests
// Runs at midnight via Vercel Cron. Must be idempotent.

import { db } from "@/lib/db";
import { today } from "@/lib/utils/dates";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorised" }, { status: 401 });
  }

  try {
    const todayStr = today();
    const todayDate = new Date(todayStr);

    // We want to lock all records whose date < today (i.e., yesterday and earlier)
    // The idempotent WHERE clause ensures already-locked records are unaffected
    await db.$transaction(async (tx) => {
      // 1. Lock all unlocked past records
      const lockResult = await tx.mealRecord.updateMany({
        where: { date: { lt: todayDate }, isLocked: false },
        data: { isLocked: true },
      });

      // 2. Find all pending edit requests whose linked meal record is now locked
      const expiredRequests = await tx.mealEditRequest.findMany({
        where: {
          status: "pending",
          mealRecord: { isLocked: true },
        },
        select: { id: true },
      });

      // 3. Expire them
      let expiredCount = 0;
      if (expiredRequests.length > 0) {
        const result = await tx.mealEditRequest.updateMany({
          where: { id: { in: expiredRequests.map((r) => r.id) } },
          data: { status: "expired" },
        });
        expiredCount = result.count;
      }

      return { locked: lockResult.count, expired: expiredCount };
    });

    return Response.json({ ok: true, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error("Cron job error:", err);
    return Response.json({ error: "Cron job failed." }, { status: 500 });
  }
}
