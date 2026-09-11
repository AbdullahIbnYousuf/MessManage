// GET /api/admin/meal-edit-requests — list all pending edit requests

import { requireAdmin } from "@/lib/session";
import { listPendingMealEditReviews } from "@/lib/services/meal-corrections";

export async function GET() {
  try {
    await requireAdmin();

    return Response.json({ data: await listPendingMealEditReviews() });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error(err);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
