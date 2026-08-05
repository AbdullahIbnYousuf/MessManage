// GET /api/maid/charges — get maid charges for a requested month

import { requireAuth } from "@/lib/session";
import { db } from "@/lib/db";
import { currentMonthKey } from "@/lib/utils/dates";

export async function GET(request: Request) {
  try {
    await requireAuth();

    const { searchParams } = new URL(request.url);
    const monthParam = searchParams.get("month");
    const requestedMonth = monthParam ?? currentMonthKey().slice(0, 7);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(requestedMonth)) {
      return Response.json({ error: "Invalid month format. Use YYYY-MM." }, { status: 400 });
    }
    const monthKey = `${requestedMonth}-01`;
    const monthDate = new Date(monthKey);

    const [charges, settlement] = await Promise.all([
      db.maidCharge.findMany({
        where: { month: monthDate },
        include: {
          user: { select: { id: true, name: true, nickname: true, avatarUrl: true, status: true } },
        },
        orderBy: { user: { name: "asc" } },
      }),
      db.monthlySettlementRun.findUnique({
        where: { month: monthDate },
        select: { id: true },
      }),
    ]);

    const config = await db.systemConfig.findFirst();

    return Response.json({
      data: {
        month: monthKey,
        isSettled: settlement !== null,
        defaultCharge: config?.maidChargeDefault.toFixed(2) ?? "700.00",
        charges: charges.map((c) => ({
          id: c.id,
          userId: c.userId,
          userName: c.user.nickname || c.user.name,
          userAvatar: c.user.avatarUrl,
          amount: c.amount.toFixed(2),
          appliedAt: c.appliedAt.toISOString(),
        })),
      },
    });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error(err);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
