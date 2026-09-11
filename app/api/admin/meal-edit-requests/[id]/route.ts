// POST /api/admin/meal-edit-requests/[id] — approve or reject one review batch

import { requireAdmin } from "@/lib/session";
import {
  MealCorrectionError,
  respondToMealEditReview,
} from "@/lib/services/meal-corrections";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid request body." }, { status: 400 });
    }
    const action = typeof body === "object" && body !== null && "action" in body
      ? body.action
      : null;
    if (action !== "approve" && action !== "reject") {
      return Response.json(
        { error: "Invalid action. Use 'approve' or 'reject'." },
        { status: 400 }
      );
    }

    const result = await respondToMealEditReview({
      adminId: admin.id,
      reviewId: id,
      action,
    });
    return Response.json({ data: result });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof MealCorrectionError) {
      return Response.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    console.error("Meal correction review failed.", error);
    return Response.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
