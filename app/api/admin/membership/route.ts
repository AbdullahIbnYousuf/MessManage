// GET /api/admin/membership — List all pending membership requests

import { requireAdmin } from "@/lib/session";
import { db } from "@/lib/db";

export async function GET() {
  try {
    await requireAdmin();

    const requests = await db.membershipRequest.findMany({
      where: { status: "pending" },
      orderBy: { requestedAt: "asc" },
    });

    return Response.json({ data: requests });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error(err);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
