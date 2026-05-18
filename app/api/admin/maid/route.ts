// POST /api/admin/maid — apply maid charges to all active members for the current month

import { requireAdmin } from "@/lib/session";
import { db } from "@/lib/db";
import { currentMonthKey, getNow } from "@/lib/utils/dates";
import Decimal from "decimal.js";

export async function POST() {
  try {
    await requireAdmin();

    const monthKey = currentMonthKey();
    const monthDate = new Date(monthKey);

    // Check if charges already applied this month
    const existing = await db.maidCharge.findFirst({
      where: { month: monthDate },
    });

    if (existing) {
      return Response.json(
        { error: "Maid charges have already been applied for this month." },
        { status: 400 }
      );
    }

    const config = await db.systemConfig.findFirst();
    const defaultCharge = new Decimal(config?.maidChargeDefault.toString() ?? "700");

    // Get all active members
    const members = await db.user.findMany({
      where: { status: "active" },
      select: { id: true },
    });

    const now = getNow();
    const chargeRows = members.map((m) => ({
      userId: m.id,
      amount: defaultCharge,
      month: monthDate,
      appliedAt: now,
    }));

    await db.maidCharge.createMany({ data: chargeRows });

    return Response.json({
      data: { applied: chargeRows.length, month: monthKey, amountEach: defaultCharge.toFixed(2) },
    });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error(err);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
