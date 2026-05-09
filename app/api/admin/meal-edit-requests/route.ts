// GET /api/admin/meal-edit-requests — list all pending edit requests

import { requireAdmin } from "@/lib/session";
import { db } from "@/lib/db";

export async function GET() {
  try {
    await requireAdmin();

    const requests = await db.mealEditRequest.findMany({
      where: { status: "pending" },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
        mealRecord: { select: { date: true, mealCount: true } },
      },
      orderBy: { requestedAt: "asc" },
    });

    return Response.json({
      data: requests.map((r) => ({
        id: r.id,
        requestedAt: r.requestedAt.toISOString(),
        user: r.user,
        mealRecord: {
          date: r.mealRecord.date.toISOString().slice(0, 10),
          mealCount: r.mealRecord.mealCount,
        },
      })),
    });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error(err);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
