// GET /api/fridge — list all fridge bills with their payments

import { requireAuth } from "@/lib/session";
import { db } from "@/lib/db";

export async function GET() {
  try {
    await requireAuth();

    const bills = await db.fridgeBill.findMany({
      orderBy: { month: "desc" },
      include: {
        allocations: {
          include: {
            user: { select: { id: true, name: true, nickname: true, avatarUrl: true } },
          },
          orderBy: { allocatedAt: "asc" },
        },
        payments: {
          include: {
            paidBy: { select: { id: true, name: true, nickname: true, avatarUrl: true } },
          },
          orderBy: { paidAt: "asc" },
        },
      },
    });

    // Check which months have been settled
    const billMonths = bills.map((b) => b.month);
    const settlements = await db.monthlySettlement.findMany({
      where: { month: { in: billMonths } },
      select: { month: true },
      distinct: ["month"],
    });
    const settledMonths = new Set(settlements.map((s) => s.month.toISOString()));

    return Response.json({
      data: bills.map((b) => {
        const allocations = b.allocations
          .map((allocation) => ({
            user: {
              id: allocation.user.id,
              name: allocation.user.nickname || allocation.user.name,
              avatarUrl: allocation.user.avatarUrl,
            },
            amount: allocation.amount.toFixed(2),
          }))
          .sort((a, b) => a.user.name.localeCompare(b.user.name));
        const amounts = b.allocations.map((allocation) => allocation.amount);

        return {
        id: b.id,
        month: b.month.toISOString().slice(0, 7), // "YYYY-MM"
        previousReading: b.previousReading.toFixed(2),
        currentReading: b.currentReading.toFixed(2),
        unitPrice: b.unitPrice.toFixed(4),
        totalAmount: b.totalAmount.toFixed(2),
        memberCount: b.memberCount,
        shareRange: amounts.length > 0 ? {
          min: amounts.reduce((min, amount) => amount.lt(min) ? amount : min).toFixed(2),
          max: amounts.reduce((max, amount) => amount.gt(max) ? amount : max).toFixed(2),
        } : null,
        allocations,
        postedAt: b.postedAt.toISOString(),
        isSettled: settledMonths.has(b.month.toISOString()),
        payments: b.payments.map((p) => ({
          id: p.id,
          paidBy: {
            id: p.paidBy.id,
            name: p.paidBy.nickname || p.paidBy.name,
            avatarUrl: p.paidBy.avatarUrl,
          },
          amount: p.amount.toFixed(2),
          paidAt: p.paidAt.toISOString(),
        })),
        };
      }),
    });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error(err);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
