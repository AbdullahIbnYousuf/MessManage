// GET /api/cron/auto-maid-charges — automatically applies maid charges on the 28th of every month
// Runs at midnight UTC on the 28th. Idempotent — skips silently if already applied.

import { db } from "@/lib/db";
import { currentMonthKey, getNow } from "@/lib/utils/dates";
import Decimal from "decimal.js";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorised" }, { status: 401 });
  }

  try {
    const monthKey = currentMonthKey();
    const monthDate = new Date(monthKey);

    // Idempotent — skip silently if charges already applied this month
    const existing = await db.maidCharge.findFirst({
      where: { month: monthDate },
    });

    if (existing) {
      return Response.json({
        message: "Maid charges already applied for this month.",
        month: monthKey,
        skipped: true,
      });
    }

    const config = await db.systemConfig.findFirst();
    const defaultCharge = new Decimal(config?.maidChargeDefault.toString() ?? "700");

    const members = await db.user.findMany({
      where: { status: "active" },
      select: { id: true },
    });

    if (members.length === 0) {
      return Response.json({
        message: "No active members found. No charges applied.",
        month: monthKey,
        applied: 0,
      });
    }

    const now = getNow();
    const chargeRows = members.map((m) => ({
      userId: m.id,
      amount: defaultCharge,
      month: monthDate,
      appliedAt: now,
    }));

    await db.maidCharge.createMany({ data: chargeRows });

    return Response.json({
      message: "Maid charges auto-applied successfully.",
      month: monthKey,
      applied: chargeRows.length,
      amountEach: defaultCharge.toFixed(2),
    });
  } catch (err) {
    console.error("auto-maid-charges cron error:", err);
    return Response.json({ error: "Something went wrong." }, { status: 500 });
  }
}
