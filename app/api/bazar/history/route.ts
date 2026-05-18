// GET /api/bazar/history — bazar expense history + visit leaderboard

import { requireAuth } from "@/lib/session";
import { db } from "@/lib/db";

export async function GET() {
  try {
    await requireAuth();

    // All-time visit counts via DB-level groupBy — no row limit, accurate for all history
    const visitCounts = await db.bazarExpense.groupBy({
      by: ["userId"],
      _count: { id: true },
    });

    // Fetch user details for everyone who has at least one expense
    const userIds = visitCounts.map((r) => r.userId);
    const users = await db.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, nickname: true, avatarUrl: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    const leaderboard = visitCounts
      .map((r) => {
        const u = userMap.get(r.userId);
        return {
          userId: r.userId,
          name: u ? (u.nickname || u.name) : "Unknown",
          avatarUrl: u?.avatarUrl ?? null,
          visits: r._count.id,
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
