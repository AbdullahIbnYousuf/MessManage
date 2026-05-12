// POST /api/fridge/bill — post a fridge electricity bill for the previous month.
// Rules:
//   - Only the previous calendar month can be billed (never current or future).
//   - Only one bill per month — duplicates are blocked.
//   - per_member_amount = totalAmount / count of members active at any point in that month.
//   - Any member can post.

import { requireAuth } from "@/lib/session";
import { db } from "@/lib/db";
import { computePerMemberAmount } from "@/lib/domain/fridge";
import { previousMonthKey, previousMonthStart, previousMonthEnd } from "@/lib/utils/dates";
import Decimal from "decimal.js";

export async function POST(request: Request) {
  try {
    await requireAuth();

    const body = await request.json() as { totalAmount: unknown };
    const raw = body.totalAmount;

    if (raw === undefined || raw === null || raw === "") {
      return Response.json({ error: "totalAmount is required." }, { status: 400 });
    }

    let totalAmount: Decimal;
    try {
      totalAmount = new Decimal(String(raw));
    } catch {
      return Response.json({ error: "Invalid totalAmount." }, { status: 400 });
    }

    if (totalAmount.lte(0)) {
      return Response.json({ error: "totalAmount must be greater than zero." }, { status: 400 });
    }

    const monthKey = previousMonthKey();
    const monthDate = new Date(monthKey);
    const prevStart = previousMonthStart();
    const prevEnd = previousMonthEnd();

    // Block duplicate bill for this month
    const existing = await db.fridgeBill.findUnique({ where: { month: monthDate } });
    if (existing) {
      return Response.json({ error: "A fridge bill for this month has already been posted." }, { status: 400 });
    }

    // Count members who were active at any point during the bill month.
    // A member is included if they joined before the month ended AND
    // (were never deactivated OR were deactivated after the month started).
    const eligibleMembers = await db.user.findMany({
      where: {
        joinedAt: { lte: prevEnd },
        OR: [
          { deactivatedAt: null },
          { deactivatedAt: { gte: prevStart } },
        ],
      },
      select: { id: true },
    });

    const memberCount = eligibleMembers.length;
    if (memberCount === 0) {
      return Response.json({ error: "No eligible members found for this month." }, { status: 400 });
    }

    const perMemberAmount = computePerMemberAmount(totalAmount, memberCount);
    if (!perMemberAmount) {
      return Response.json({ error: "Failed to compute per-member amount." }, { status: 500 });
    }

    const user = await requireAuth();
    const bill = await db.fridgeBill.create({
      data: {
        month: monthDate,
        totalAmount,
        perMemberAmount,
        memberCount,
        postedAt: new Date(),
        postedById: user.id,
      },
    });

    return Response.json({
      data: {
        id: bill.id,
        month: monthKey.slice(0, 7),
        totalAmount: bill.totalAmount.toFixed(2),
        perMemberAmount: bill.perMemberAmount.toFixed(2),
        memberCount: bill.memberCount,
      },
    }, { status: 201 });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error(err);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
