// GET /api/fridge — list all fridge bills with their payments

import { requireAuth } from "@/lib/session";
import { db } from "@/lib/db";

export async function GET() {
  try {
    await requireAuth();

    const bills = await db.fridgeBill.findMany({
      orderBy: { month: "desc" },
      include: {
        payments: {
          include: {
            paidBy: { select: { id: true, name: true, nickname: true, avatarUrl: true } },
          },
          orderBy: { paidAt: "asc" },
        },
      },
    });

    return Response.json({
      data: bills.map((b) => ({
        id: b.id,
        month: b.month.toISOString().slice(0, 7), // "YYYY-MM"
        totalAmount: b.totalAmount.toFixed(2),
        perMemberAmount: b.perMemberAmount.toFixed(2),
        memberCount: b.memberCount,
        postedAt: b.postedAt.toISOString(),
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
      })),
    });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error(err);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
