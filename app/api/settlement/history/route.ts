// GET /api/settlement/history — list all past monthly settlements

import { requireAuth } from "@/lib/session";
import { db } from "@/lib/db";

export async function GET() {
  try {
    await requireAuth();

    const runs = await db.monthlySettlementRun.findMany({
      include: {
        settlements: {
          include: {
            fromUser: { select: { id: true, name: true, nickname: true, avatarUrl: true } },
            toUser: { select: { id: true, name: true, nickname: true, avatarUrl: true } },
          },
          orderBy: { amount: "desc" },
        },
      },
      orderBy: { month: "desc" },
    });

    return Response.json({
      data: runs.map((run) => ({
        month: run.month.toISOString().slice(0, 7),
        settledAt: run.settledAt.toISOString(),
        transfers: run.settlements.map((settlement) => ({
          id: settlement.id,
          fromUser: {
            ...settlement.fromUser,
            name: settlement.fromUser.nickname || settlement.fromUser.name,
          },
          toUser: {
            ...settlement.toUser,
            name: settlement.toUser.nickname || settlement.toUser.name,
          },
          amount: settlement.amount.toFixed(2),
        })),
      })),
    });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error(err);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
