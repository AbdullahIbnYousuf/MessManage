// GET /api/maid/charges — get maid charges for the current month (all active members)
// Used to show the current month charge status

import { requireAuth } from "@/lib/session";
import { db } from "@/lib/db";
import { currentMonthKey } from "@/lib/utils/dates";

export async function GET() {
  try {
    await requireAuth();

    const monthKey = currentMonthKey();
    const monthDate = new Date(monthKey);

    const charges = await db.maidCharge.findMany({
      where: { month: monthDate },
      include: {
        user: { select: { id: true, name: true, nickname: true, avatarUrl: true, status: true } },
      },
      orderBy: { user: { name: "asc" } },
    });

    const config = await db.systemConfig.findFirst();

    return Response.json({
      data: {
        month: monthKey,
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
