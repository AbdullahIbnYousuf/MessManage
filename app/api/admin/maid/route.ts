// POST /api/admin/maid — manually apply maid charges for an unsettled month

import { requireAdmin } from "@/lib/session";
import { db } from "@/lib/db";
import { isMemberEligibleForMaidCharge } from "@/lib/domain/maid";
import { currentMonthKey, getNow } from "@/lib/utils/dates";
import Decimal from "decimal.js";

export async function POST(request: Request) {
  try {
    await requireAdmin();

    const body = await request.json().catch(() => ({})) as { month?: unknown };
    const requestedMonth = typeof body.month === "string" ? body.month : currentMonthKey().slice(0, 7);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(requestedMonth)) {
      return Response.json({ error: "Invalid month format. Use YYYY-MM." }, { status: 400 });
    }

    const monthKey = `${requestedMonth}-01`;
    if (monthKey > currentMonthKey()) {
      return Response.json({ error: "Maid charges cannot be applied to a future month." }, { status: 400 });
    }

    const monthDate = new Date(monthKey);
    const settled = await db.monthlySettlement.findFirst({
      where: { month: monthDate },
      select: { id: true },
    });
    if (settled) {
      return Response.json({ error: "This month has already been settled." }, { status: 400 });
    }

    // A month is either wholly uncharged or charged once for every eligible member.
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

    // For a past month, use lifecycle dates rather than current account status.
    const members = await db.user.findMany({
      select: { id: true, joinedAt: true, deactivatedAt: true },
    });
    const eligibleMembers = members.filter((member) =>
      isMemberEligibleForMaidCharge(member.joinedAt, member.deactivatedAt, monthDate)
    );

    if (eligibleMembers.length === 0) {
      return Response.json({ error: "No members were active during this month." }, { status: 400 });
    }

    const now = getNow();
    const chargeRows = eligibleMembers.map((member) => ({
      userId: member.id,
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
