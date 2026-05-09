// POST /api/admin/meal-edit-requests/[id] — approve or reject a meal edit request

import { requireAdmin } from "@/lib/session";
import { db } from "@/lib/db";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const body = await request.json() as { action: string };
    const { action } = body;

    if (action !== "approve" && action !== "reject") {
      return Response.json({ error: "Invalid action. Use 'approve' or 'reject'." }, { status: 400 });
    }

    const editRequest = await db.mealEditRequest.findUnique({
      where: { id },
      include: { mealRecord: true },
    });

    if (!editRequest) {
      return Response.json({ error: "Edit request not found." }, { status: 404 });
    }

    if (editRequest.status !== "pending") {
      return Response.json({ error: "This request has already been reviewed or expired." }, { status: 400 });
    }

    // Safety check: if the meal record is locked, auto-expire instead
    if (editRequest.mealRecord.isLocked) {
      await db.mealEditRequest.update({
        where: { id },
        data: { status: "expired", reviewedAt: new Date(), reviewedById: admin.id },
      });
      return Response.json({ error: "The meal record has been locked. The request is now expired." }, { status: 400 });
    }

    const newStatus = action === "approve" ? "approved" : "rejected";

    await db.mealEditRequest.update({
      where: { id },
      data: {
        status: newStatus,
        reviewedById: admin.id,
        reviewedAt: new Date(),
      },
    });

    return Response.json({ data: { status: newStatus } });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error(err);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
