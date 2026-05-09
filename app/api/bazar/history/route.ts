// GET /api/bazar/history — bazar expense history + visit/spending leaderboard

import { requireAuth } from "@/lib/session";
import { db } from "@/lib/db";

export async function GET() {
  try {
    await requireAuth();

    // Get all completed expenses with user info
    const expenses = await db.bazarExpense.findMany({
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
        trip: { select: { id: true, completedAt: true } },
      },
      orderBy: { submittedAt: "desc" },
      take: 50, // last 50 entries
    });

    // Build leaderboard: visits = count of expenses per user, spending = sum
    const leaderMap = new Map<
      string,
      { userId: string; name: string; avatarUrl: string | null; visits: number; totalSpend: string }
    >();

    for (const e of expenses) {
      const existing = leaderMap.get(e.userId);
      if (existing) {
        existing.visits += 1;
        existing.totalSpend = (parseFloat(existing.totalSpend) + parseFloat(e.amount.toString())).toFixed(2);
      } else {
        leaderMap.set(e.userId, {
          userId: e.userId,
          name: e.user.name,
          avatarUrl: e.user.avatarUrl,
          visits: 1,
          totalSpend: e.amount.toFixed(2),
        });
      }
    }

    // Also include members with 0 visits from the all-time expense list isn't needed here
    // Just return what we have from the expenses

    return Response.json({
      data: {
        expenses: expenses.map((e) => ({
          id: e.id,
          userId: e.userId,
          userName: e.user.name,
          userAvatar: e.user.avatarUrl,
          amount: e.amount.toFixed(2),
          note: e.note,
          date: e.date.toISOString().slice(0, 10),
          submittedAt: e.submittedAt.toISOString(),
        })),
        leaderboard: Array.from(leaderMap.values()).sort((a, b) => b.visits - a.visits),
      },
    });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error(err);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
