// GET /api/bazar/history — bazar expense history + visit leaderboard

import { requireAuth } from "@/lib/session";
import { db } from "@/lib/db";
import Decimal from "decimal.js";

export async function GET() {
  try {
    await requireAuth();

    // All expenses for leaderboard aggregation (tripWeight sum per user)
    const allExpenses = await db.bazarExpense.findMany({
      select: { userId: true, tripWeight: true },
    });

    // Sum tripWeight per user
    const weightMap = new Map<string, Decimal>();
    for (const e of allExpenses) {
      const prev = weightMap.get(e.userId) ?? new Decimal(0);
      weightMap.set(e.userId, prev.plus(new Decimal(e.tripWeight.toString())));
    }

    // Fetch user details for everyone who has at least one expense and is active
    const userIds = [...weightMap.keys()];
    const users = await db.user.findMany({
      where: { id: { in: userIds }, status: "active" },
      select: { id: true, name: true, nickname: true, avatarUrl: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    const leaderboard = userIds
      .filter((userId) => userMap.has(userId))
      .map((userId) => {
        const u = userMap.get(userId)!;
        return {
          userId,
          name: u.nickname || u.name,
          avatarUrl: u.avatarUrl,
          visits: parseFloat((weightMap.get(userId) ?? new Decimal(0)).toFixed(1)),
        };
      })
      .sort((a, b) => b.visits - a.visits);

    // Last 50 expenses for the recent history list only
    const expenses = await db.bazarExpense.findMany({
      include: {
        user: { select: { id: true, name: true, nickname: true, avatarUrl: true } },
      },
      orderBy: { submittedAt: "desc" },
      take: 50,
    });

    return Response.json({
      data: {
        expenses: expenses.map((e) => ({
          id: e.id,
          userId: e.userId,
          userName: e.user.nickname || e.user.name,
          userAvatar: e.user.avatarUrl,
          amount: e.amount.toFixed(2),
          note: e.note,
          date: e.date.toISOString().slice(0, 10),
          submittedAt: e.submittedAt.toISOString(),
          tripWeight: parseFloat(e.tripWeight.toString()),
          isInstant: parseFloat(e.tripWeight.toString()) < 1,
        })),
        leaderboard,
      },
    });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error(err);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
