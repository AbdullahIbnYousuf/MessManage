// GET /api/settlement/history — list all past monthly settlements

import { requireAuth } from "@/lib/session";
import { db } from "@/lib/db";

export async function GET() {
  try {
    await requireAuth();

    const settlements = await db.monthlySettlement.findMany({
      include: {
        fromUser: { select: { id: true, name: true, avatarUrl: true } },
        toUser: { select: { id: true, name: true, avatarUrl: true } },
      },
      orderBy: { month: "desc" },
    });

    // Group by month
    const byMonth = new Map<string, typeof settlements>();
    for (const s of settlements) {
      const key = s.month.toISOString().slice(0, 7);
      if (!byMonth.has(key)) byMonth.set(key, []);
      byMonth.get(key)!.push(s);
    }

    return Response.json({
      data: Array.from(byMonth.entries()).map(([month, rows]) => ({
        month,
        settledAt: rows[0]!.settledAt.toISOString(),
        transfers: rows.map((r) => ({
          id: r.id,
          fromUser: r.fromUser,
          toUser: r.toUser,
          amount: r.amount.toFixed(2),
        })),
      })),
    });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error(err);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
